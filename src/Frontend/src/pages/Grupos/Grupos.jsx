// src/pages/Grupos/Grupos.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Grupos.css";

/**
 * Grupos.jsx (Unificado)
 * - Combina lógica antiga (localStorage, capa base64, auto-atribuição de mentor)
 * com o novo comportamento rotas backend (GET/POST/PUT/DELETE /api/grupos).
 * - Ao criar/editar/excluir atualiza:
 * 1) estado local (setGrupos)
 * 2) localStorage (keys: le_grupos_v2, grupos) para compat com PainelInicial
 *
 * Regras:
 * - Mentor: quando cria -> atribuído como mentor e também membro
 * - Aluno: quando cria -> atribuído automaticamente como membro (não mentor)
 * - Ambos podem subir uma imagem de capa (capaDataUrl) em base64 que é enviada ao backend
 *
 * Nota: para testes off-line, mantenho alguns helpers de LS/migrate.
 */

/* =========================
   Config da API
   ========================= */
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "https://projeto-interdisciplinar-2.onrender.com/api";
// // ajuste se necessário

/* =========================
   LocalStorage helpers (compatibilidade com antigo)
   ========================= */
const LS_KEYS = {
  grupos: "le_grupos_v2",
  legacyGrupos: "grupos",
};

const LS = {
  get(key, fb) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fb;
    } catch {
      return fb;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  },
  migrate() {
    try {
      const novo = localStorage.getItem(LS_KEYS.grupos);
      const legado = localStorage.getItem(LS_KEYS.legacyGrupos);
      if (!novo && legado) {
        localStorage.setItem(LS_KEYS.grupos, legado);
      }
    } catch {}
  },
  clearOnlyGrupos() {
    try {
      localStorage.removeItem(LS_KEYS.grupos);
      localStorage.removeItem(LS_KEYS.legacyGrupos);
    } catch {}
  },
};

if (typeof window !== "undefined")
  window.__LE_CLEAR_GRUPOS__ = () => LS.clearOnlyGrupos();

/* =========================
   Utils
   ========================= */
const currency = (v) =>
  Number(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const initials = (name = "?") =>
  String(name)
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/* =========================
   Componente principal
   ========================= */
export default function Grupos() {
  /* -------------------------
     Perfil (do localStorage)
     ------------------------- */
  const [perfil] = useState(() => {
    //
    try {
      return JSON.parse(localStorage.getItem("perfil")) ?? {};
    } catch {
      return {};
    }
  });
  const isStudent = perfil.tipo === "aluno"; //
  const isMentor = perfil.tipo === "mentor"; //
  const isAdmin = perfil.tipo === "adm"; //
  const isMentorLike = isMentor || isAdmin; //

  /* -------------------------
     Router & navegação
     ------------------------- */
  const navigate = useNavigate();
  const location = useLocation();

  /* -------------------------
     Estados globais
     ------------------------- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [grupos, setGrupos] = useState([]);
  const [q, setQ] = useState("");
  const [order, setOrder] = useState("recentes"); // recentes | a_z | z_a

  /* -------------------------
     Abas
     ------------------------- */
  const tabs = ["criar", "editar"];
  const [aba, setAba] = useState(() => {
    //
    const qs = new URLSearchParams(location.search);
    const t = qs.get("tab");
    if (tabs.includes(t)) return t;
    return isStudent ? "editar" : "criar";
  });
  useEffect(() => {
    //
    const qs = new URLSearchParams(location.search);
    const t = qs.get("tab");
    if (t && tabs.includes(t) && t !== aba) setAba(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  /* =========================
     Inicialização: carregar grupos (backend -> fallback localStorage)
     ========================= */
  useEffect(() => {
    //
    LS.migrate(); //

    let abort = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const resp = await fetch(`${API_BASE}/grupos`); //
        if (!resp.ok) {
          // fallback: tenta ler do localStorage se backend indisponível
          throw new Error("Falha ao carregar do servidor");
        }
        const data = await resp.json();
        if (!abort) {
          setGrupos(Array.isArray(data) ? data : []);
          // manter compat com PainelInicial: atualiza localStorage
          LS.set(LS_KEYS.grupos, Array.isArray(data) ? data : []); //
          LS.set(LS_KEYS.legacyGrupos, Array.isArray(data) ? data : []); //
        }
      } catch (e) {
        // tenta ler do localStorage
        try {
          const arr = LS.get(LS_KEYS.grupos, LS.get(LS_KEYS.legacyGrupos, [])); //
          if (!abort) setGrupos(Array.isArray(arr) ? arr : []);
        } catch (er) {
          if (!abort) setError("Erro ao carregar grupos.");
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, []);

  // sempre manter localStorage em sincronia com estado
  useEffect(() => {
    //
    try {
      LS.set(LS_KEYS.grupos, grupos); //
      LS.set(LS_KEYS.legacyGrupos, grupos); //
    } catch {}
  }, [grupos]);

  /* =========================
     Filtragem e ordenação
     ========================= */
  const gruposFiltrados = useMemo(() => {
    //
    let list = Array.isArray(grupos) ? [...grupos] : [];
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (g) =>
          (g.nome ?? "").toLowerCase().includes(s) ||
          (g.mentor ?? "").toLowerCase().includes(s) ||
          (g.membros ?? []).some(
            (m) =>
              (m.nome ?? "").toLowerCase().includes(s) ||
              String(m.ra ?? "").includes(s)
          )
      );
    }
    if (order === "a_z")
      list.sort((a, b) =>
        String(a.nome).localeCompare(String(b.nome), "pt-BR")
      );
    else if (order === "z_a")
      list.sort((a, b) =>
        String(b.nome).localeCompare(String(a.nome), "pt-BR")
      );
    else list.sort((a, b) => Number(b.id) - Number(a.id)); // recentes por id (backend deve prover id incremental)
    return list;
  }, [grupos, q, order]);

  /* =========================
     Badges & Helpers
     ========================= */
  const getStatusBadges = (g) => {
    //
    const out = [];
    const meta = Number(g.metaArrecadacao ?? 0);
    const prog = Number(g.progressoArrecadacao ?? 0);
    if (meta <= 0) out.push({ type: "neutral", text: "Sem meta" });
    else if (prog >= meta)
      out.push({ type: "success", text: "Meta concluída" });
    else
      out.push({
        type: "progress",
        text: `${Math.floor((prog / meta) * 100)}% da meta`,
      });

    out.push({
      type: g.mentor ? "mentor" : "warn",
      text: g.mentor ? "Com mentor" : "Sem mentor",
    });
    out.push({ type: "info", text: `${(g.membros ?? []).length} membro(s)` });
    return out;
  };

  /* =========================
     CRIAR GRUPO
     ========================= */
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    nome: "",
    metaArrecadacao: "",
    metaAlimentos: "",
  }); //
  const [createMembers, setCreateMembers] = useState(() =>
    //
    isStudent
      ? [{ nome: perfil.nome ?? "", ra: perfil.ra ?? "", telefone: "" }]
      : [{ nome: "", ra: "", telefone: "" }]
  );

  // capa (base64) - herdado do antigo
  const [capaUrl, setCapaUrl] = useState(""); //
  const capaRef = useRef(null); //
  const onPickCapa = (e) => {
    //
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type?.startsWith("image/")) {
      setMessage({ type: "error", text: "Selecione uma imagem válida." });
      return;
    }
    const rd = new FileReader();
    rd.onload = () => setCapaUrl(String(rd.result));
    rd.readAsDataURL(f);
  };
  const removeCapa = () => {
    //
    setCapaUrl("");
    if (capaRef.current) capaRef.current.value = "";
  };

  // Paste members (bulk)
  const [pasteOpen, setPasteOpen] = useState(false); //
  const [pasteText, setPasteText] = useState(""); //
  const parseLine = (line) => {
    //
    const raw = line.trim();
    if (!raw) return null;
    let parts = raw
      .split(/[;,\t]|\s{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 1) {
      const m = raw.match(/^(.*)\s+([A-Za-z0-9\-\_\.]+)$/);
      if (m) parts = [m[1].trim(), m[2].trim()];
    }
    const [nome, ra, telefone = ""] = parts;
    if (!nome || !ra) return null;
    return { nome, ra, telefone };
  };
  const onPasteMembers = () => {
    //
    const lines = pasteText.split(/\r?\n/);
    const parsed = [];
    lines.forEach((l) => {
      const m = parseLine(l);
      if (m) parsed.push(m);
    });
    if (!parsed.length) {
      setMessage({
        type: "error",
        text: "Nenhum membro válido encontrado. Use: Nome;RA;Telefone",
      });
      return;
    }
    setCreateMembers((prev) => [...prev, ...parsed]);
    setPasteText("");
    setPasteOpen(false);
  };

  const createValid = useMemo(() => {
    //
    if (!createForm.nome.trim()) return false;
    if (!isStudent && !String(createForm.metaArrecadacao ?? "").length)
      return false;
    if (createMembers.some((m) => !m.nome?.trim() || !m.ra?.trim()))
      return false;
    return true;
  }, [createForm, createMembers, isStudent]);

  const onCreate = async (e) => {
    //
    e.preventDefault();
    if (!createValid) {
      setMessage({ type: "error", text: "Preencha os campos obrigatórios." });
      return;
    }
    setCreating(true);
    try {
      // preparar membros: se mentor -> adiciona mentor também como membro
      const autoMember = isMentor
        ? {
            nome: perfil.nome || "",
            ra: perfil.ra || "",
            telefone: perfil.telefone || "",
          }
        : isStudent
        ? {
            nome: perfil.nome || "",
            ra: perfil.ra || "",
            telefone: perfil.telefone || "",
          }
        : null;

      // merge members: garantir que o autor apareça primeiro (se aplicável) e sem duplicatas por RA
      const incoming = createMembers.filter((m) => m.nome && m.ra);
      const merged = [];
      if (autoMember) merged.push(autoMember);
      incoming.forEach((im) => {
        const exists = merged.some((x) => String(x.ra) === String(im.ra));
        if (!exists) merged.push(im);
      });

      const payload = {
        nome: createForm.nome.trim(),
        metaArrecadacao: isStudent
          ? 0
          : Number(createForm.metaArrecadacao ?? 0),
        metaAlimentos: isStudent ? "" : createForm.metaAlimentos ?? "",
        membros: merged,
        mentor: isMentor ? perfil.nome || undefined : undefined,
        mentorFotoUrl: isMentor ? perfil.fotoUrl || undefined : undefined,
        capaDataUrl: capaUrl || undefined,
      };

      // POST para backend
      const resp = await fetch(`${API_BASE}/grupos`, {
        //
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        // tenta extrair mensagem do servidor
        let msg = "Erro ao criar grupo";
        try {
          const json = await resp.json();
          if (json?.error) msg = json.error;
        } catch {}
        throw new Error(msg);
      }

      const novo = await resp.json();

      // atualiza estado local e LS
      setGrupos((prev) => [novo, ...prev]);
      LS.set(LS_KEYS.grupos, [novo, ...LS.get(LS_KEYS.grupos, [])]); //
      LS.set(LS_KEYS.legacyGrupos, [novo, ...LS.get(LS_KEYS.legacyGrupos, [])]); //

      // UI cleanup
      setCreateForm({ nome: "", metaArrecadacao: "", metaAlimentos: "" });
      setCreateMembers(
        isStudent
          ? [{ nome: perfil.nome ?? "", ra: perfil.ra ?? "", telefone: "" }]
          : [{ nome: "", ra: "", telefone: "" }]
      );
      removeCapa();
      setMessage({ type: "success", text: "Grupo criado com sucesso!" });
      setTimeout(() => setMessage(""), 2000);
      setAba("editar");
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.message ?? "Erro ao criar grupo.",
      });
    } finally {
      setCreating(false);
    }
  };

  /* =========================
     EDITAR GRUPO
     ========================= */
  const [editId, setEditId] = useState(null); //
  const [editForm, setEditForm] = useState({
    nome: "",
    metaArrecadacao: "",
    metaAlimentos: "",
  }); //
  const [editMembers, setEditMembers] = useState([
    { nome: "", ra: "", telefone: "" },
  ]); //
  const [editCapa, setEditCapa] = useState(""); //
  const editCapaRef = useRef(null); //

  // pick edit cover (base64)
  const onPickEditCapa = (e) => {
    //
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type?.startsWith("image/")) {
      setMessage({ type: "error", text: "Selecione uma imagem válida." });
      return;
    }
    const rd = new FileReader();
    rd.onload = () => setEditCapa(String(rd.result));
    rd.readAsDataURL(f);
  };
  const removeEditCapa = () => {
    //
    setEditCapa("");
    if (editCapaRef.current) editCapaRef.current.value = "";
  };

  const startEdit = (g) => {
    //
    setEditId(g.id);
    setEditForm({
      nome: g.nome ?? "",
      metaArrecadacao: String(g.metaArrecadacao ?? ""),
      metaAlimentos: g.metaAlimentos ?? "",
    });
    setEditMembers(
      (g.membros?.length
        ? g.membros
        : [{ nome: "", ra: "", telefone: "" }]
      ).map((m) => ({ ...m, telefone: m.telefone || "" }))
    );
    setEditCapa(g.capaDataUrl || g.capaUrl || "");
    window.scrollTo(0, 0);
  };

  // paste members edit
  const [pasteOpenEdit, setPasteOpenEdit] = useState(false); //
  const [pasteTextEdit, setPasteTextEdit] = useState(""); //
  const onPasteMembersEdit = () => {
    //
    const lines = pasteTextEdit.split(/\r?\n/);
    const parsed = [];
    lines.forEach((l) => {
      const m = parseLine(l);
      if (m) parsed.push(m);
    });
    if (!parsed.length) {
      setMessage({ type: "error", text: "Nenhum membro válido encontrado." });
      return;
    }
    setEditMembers((prev) => [...prev, ...parsed]);
    setPasteTextEdit("");
    setPasteOpenEdit(false);
  };

  const [saving, setSaving] = useState(false); //
  const onSave = async (e) => {
    //
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      const payload = {
        nome: editForm.nome.trim(),
        metaArrecadacao: Number(editForm.metaArrecadacao ?? 0),
        metaAlimentos: editForm.metaAlimentos ?? "",
        membros: isStudent
          ? editMembers.filter((m) => m.nome && m.ra)
          : undefined,
        // se mentor (criador) estiver editando, atualiza info de mentor no grupo:
        mentor: isMentor ? perfil.nome || undefined : undefined,
        mentorFotoUrl: isMentor ? perfil.fotoUrl || undefined : undefined,
        capaDataUrl: editCapa || undefined,
      };

      const r = await fetch(`${API_BASE}/grupos/${editId}`, {
        //
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        let msg = "Falha ao salvar grupo";
        try {
          const j = await r.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      const atualizado = await r.json();
      setGrupos((prev) => prev.map((x) => (x.id === editId ? atualizado : x)));
      // atualizar localStorage
      const all = LS.get(LS_KEYS.grupos, []).map((x) =>
        x.id === editId ? atualizado : x
      ); //
      LS.set(LS_KEYS.grupos, all); //
      LS.set(LS_KEYS.legacyGrupos, all); //

      setEditId(null);
      setMessage({ type: "success", text: "Grupo atualizado." });
      setTimeout(() => setMessage(""), 2000);
    } catch (e2) {
      setMessage({ type: "error", text: e2?.message ?? "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     EXCLUIR GRUPO
     ========================= */
  const [confirm, setConfirm] = useState({ open: false, id: null, name: "" }); //
  const askDelete = (g) => setConfirm({ open: true, id: g.id, name: g.nome }); //
  const doDelete = async () => {
    //
    const id = confirm.id;
    setConfirm({ open: false, id: null, name: "" });
    if (!id) return;
    try {
      const r = await fetch(`${API_BASE}/grupos/${id}`, { method: "DELETE" }); //
      if (!r.ok) {
        let msg = "Falha ao excluir";
        try {
          const j = await r.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      setGrupos((prev) => prev.filter((x) => x.id !== id));
      // atualizar LS
      const all = LS.get(LS_KEYS.grupos, []).filter((x) => x.id !== id); //
      LS.set(LS_KEYS.grupos, all); //
      LS.set(LS_KEYS.legacyGrupos, all); //

      if (editId === id) setEditId(null);
      setMessage({ type: "success", text: "Grupo excluído." });
      setTimeout(() => setMessage(""), 1500);
    } catch (e2) {
      setMessage({ type: "error", text: e2?.message ?? "Erro ao excluir." });
    }
  };

  /* =========================
     Render completo (UI)
     ========================= */
  return (
    <div className="grupos-page-container">
      {/* Header */}
      <div className="grupos-page-header">
        <h1>Grupos</h1>
        <button onClick={() => navigate("/painel")} className="btn-secondary">
          Voltar ao Painel
        </button>
      </div>

      {/* Toolbar */}
      <div className="toolbar-row">
        <div className="left">
          <input
            className="input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, mentor ou membro"
          />
        </div>

        <div className="right">
          <select
            className="input"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="recentes">Mais recentes</option>
            <option value="a_z">A–Z</option>
            <option value="z_a">Z–A</option>
          </select>

          <div className="tabs">
            <button
              className={`btn-secondary ${aba === "criar" ? "active" : ""}`}
              onClick={() => setAba("criar")}
              disabled={isStudent}
              title={isStudent ? "Alunos só podem editar" : undefined}
            >
              Criar
            </button>
            <button
              className={`btn-secondary ${aba === "editar" ? "active" : ""}`}
              onClick={() => setAba("editar")}
            >
              Editar
            </button>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      {error && (
        <p className="message error" role="alert">
          {String(error)}
        </p>
      )}
      {message && (
        <p className={`message ${message.type ?? "success"}`}>
          {message.text ?? String(message)}
        </p>
      )}

      {/* Conteúdo */}
      {loading ? (
        <div className="skeleton-list" aria-busy>
          <div className="sk-row" />
          <div className="sk-row" />
          <div className="sk-row" />
        </div>
      ) : (
        <>
          {/* Aba Criar */}
          {aba === "criar" && !isStudent && (
            <div className="form-card">
              <h2>Criar Novo Grupo</h2>
              <form onSubmit={onCreate}>
                <div className="form-group">
                  <label htmlFor="nome">Nome do Grupo</label>
                  <input
                    id="nome"
                    name="nome"
                    type="text"
                    value={createForm.nome}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, nome: e.target.value }))
                    }
                    placeholder="Ex: Campanha de Natal 2025"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Membros do Grupo</label>
                  {createMembers.map((m, i) => (
                    <div key={i} className="member-input-group">
                      <input
                        type="text"
                        name="nome"
                        value={m.nome}
                        onChange={(e) => {
                          const cp = [...createMembers];
                          cp[i] = { ...cp[i], nome: e.target.value };
                          setCreateMembers(cp);
                        }}
                        placeholder="Nome"
                        required
                        disabled={isStudent && i === 0}
                      />
                      <input
                        type="text"
                        name="ra"
                        value={m.ra}
                        onChange={(e) => {
                          const cp = [...createMembers];
                          cp[i] = { ...cp[i], ra: e.target.value };
                          setCreateMembers(cp);
                        }}
                        placeholder="RA"
                        required
                        disabled={isStudent && i === 0}
                      />
                      <input
                        type="tel"
                        name="telefone"
                        value={m.telefone}
                        onChange={(e) => {
                          const cp = [...createMembers];
                          cp[i] = { ...cp[i], telefone: e.target.value };
                          setCreateMembers(cp);
                        }}
                        placeholder="Telefone (opcional)"
                      />
                      {createMembers.length > 1 && !isStudent && (
                        <button
                          type="button"
                          className="btn-danger-small"
                          title="Remover"
                          onClick={() => {
                            const cp = [...createMembers];
                            cp.splice(i, 1);
                            setCreateMembers(cp);
                          }}
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="paste-row" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setPasteOpen((o) => !o)}
                    >
                      Colar lista de membros
                    </button>
                    {pasteOpen && (
                      <div className="paste-block">
                        <textarea
                          rows={5}
                          className="input"
                          placeholder={
                            "Um por linha. Ex:\nMaria Silva;12345;1199999-0000\nJoão Souza,54321"
                          }
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                        />
                        <div className="form-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={onPasteMembers}
                          >
                            Processar
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => {
                              setPasteText("");
                              setPasteOpen(false);
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isStudent && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setCreateMembers((prev) => [
                          ...prev,
                          { nome: "", ra: "", telefone: "" },
                        ])
                      }
                      style={{ marginTop: 10 }}
                    >
                      Adicionar Membro
                    </button>
                  )}
                </div>

                {!isStudent && (
                  <>
                    <div className="form-group">
                      <label htmlFor="metaArrecadacao">
                        Meta de Arrecadação (R$)
                      </label>
                      <input
                        id="metaArrecadacao"
                        type="number"
                        value={createForm.metaArrecadacao}
                        onChange={(e) =>
                          setCreateForm((f) => ({
                            ...f,
                            metaArrecadacao: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="metaAlimentos">
                        Meta de Alimentos (Opcional)
                      </label>
                      <input
                        id="metaAlimentos"
                        type="text"
                        value={createForm.metaAlimentos}
                        onChange={(e) =>
                          setCreateForm((f) => ({
                            ...f,
                            metaAlimentos: e.target.value,
                          }))
                        }
                        placeholder="Ex: 100 cestas básicas"
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Imagem de capa (opcional)</label>
                  {capaUrl ? (
                    <div className="cover-preview">
                      <img src={capaUrl} alt="Capa do grupo" />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={removeCapa}
                        >
                          Remover capa
                        </button>
                      </div>
                    </div>
                  ) : (
                    <input
                      ref={capaRef}
                      type="file"
                      accept="image/*"
                      onChange={onPickCapa}
                    />
                  )}
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={creating || !createValid}
                  >
                    {creating ? "Criando…" : "Criar Grupo"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Aba Editar */}
          {aba === "editar" && (
            <>
              <div className="list-card">
                <h2>Grupos Existentes</h2>

                {gruposFiltrados.length === 0 ? (
                  <p>
                    {isStudent
                      ? "Você ainda não faz parte de um grupo."
                      : "Nenhum grupo encontrado."}
                  </p>
                ) : (
                  <ul className="grupos-list">
                    {gruposFiltrados.map((g) => {
                      const badges = getStatusBadges(g);
                      // Calcula percentual financeiro
                      const percent = Math.min(
                        (Number(g.progressoArrecadacao ?? 0) /
                          Math.max(Number(g.metaArrecadacao ?? 1), 1)) *
                          100,
                        100
                      );

                      return (
                        <li key={g.id} className="grupo-item">
                          <div className="grupo-cover">
                            {g.capaDataUrl ? (
                              <img src={g.capaDataUrl} alt="Capa do grupo" />
                            ) : g.capaUrl ? (
                              <img src={g.capaUrl} alt="Capa do grupo" />
                            ) : (
                              <div className="cover-ph">Sem capa</div>
                            )}
                          </div>

                          <div className="grupo-info">
                            <div className="title-row">
                              <h3>{g.nome}</h3>
                              <div
                                className="mentor-pill"
                                title={
                                  g.mentor
                                    ? `Mentor: ${g.mentor}`
                                    : "Sem mentor"
                                }
                              >
                                {g.mentorFotoUrl ? (
                                  <img
                                    src={g.mentorFotoUrl}
                                    alt="Foto do mentor"
                                    className="mentor-avatar"
                                  />
                                ) : (
                                  <span className="mentor-avatar initials">
                                    {g.mentor ? initials(g.mentor) : "—"}
                                  </span>
                                )}
                                <span className="mentor-name">
                                  {g.mentor ?? "Sem mentor"}
                                </span>
                              </div>
                            </div>

                            <div className="badges">
                              {badges.map((b, i) => (
                                <span key={i} className={`chip chip-${b.type}`}>
                                  {b.text}
                                </span>
                              ))}
                            </div>

                            {/* --- Meta Financeira --- */}
                            <div>
                              <strong>Meta Financeira:</strong>{" "}
                              {currency(g.metaArrecadacao)}
                              <br />
                              <strong>Arrecadado:</strong>{" "}
                              {currency(g.progressoArrecadacao)}
                            </div>
                            <div className="progress-bar-container">
                              <div
                                className="progress-bar-fill"
                                style={{ width: `${percent}%` }}
                                aria-valuenow={percent}
                                aria-valuemin="0"
                                aria-valuemax="100"
                                role="progressbar"
                                aria-label={`Progresso financeiro: ${percent.toFixed(
                                  1
                                )}%`}
                              />
                            </div>

                            {/* --- Meta Alimentos (NOVA SEÇÃO) --- */}
                            {g.metaAlimentos && (
                              <div
                                className="meta-alimentos-section"
                                style={{ marginTop: "0.75rem" }}
                              >
                                <strong>Meta Alimentos:</strong>{" "}
                                {g.metaAlimentos}
                                {(() => {
                                  const match = String(g.metaAlimentos).match(
                                    /\d+/
                                  );
                                  const metaNum = match
                                    ? parseInt(match[0], 10)
                                    : 0;

                                  // Placeholder: O backend PRECISA retornar g.progressoAlimentos
                                  const progressoNum =
                                    g.progressoAlimentos ?? 0; // <<< SUBSTITUIR PELO DADO REAL DO BACKEND

                                  const percentAlimentos =
                                    metaNum > 0
                                      ? Math.min(
                                          (progressoNum / metaNum) * 100,
                                          100
                                        )
                                      : 0;

                                  return (
                                    <>
                                      <br />
                                      <strong>Progresso Alimentos:</strong>{" "}
                                      {progressoNum}{" "}
                                      {metaNum > 0 ? ` / ${metaNum}` : ""}
                                      <div className="progress-bar-container">
                                        <div
                                          className="progress-bar-fill"
                                          style={{
                                            width: `${percentAlimentos}%`,
                                          }}
                                          aria-valuenow={percentAlimentos}
                                          aria-valuemin="0"
                                          aria-valuemax="100"
                                          role="progressbar"
                                          aria-label={`Progresso de alimentos: ${percentAlimentos.toFixed(
                                            1
                                          )}%`}
                                        />
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}

                            {g.membros?.length > 0 && (
                              <div className="member-list">
                                <strong>Membros:</strong>
                                <ul>
                                  {g.membros.map((m, i) => (
                                    <li key={i}>
                                      {m.nome} ({m.ra})
                                      {m.telefone ? ` - ${m.telefone}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          <div
                            className="grupo-actions"
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                            }}
                          >
                            {(!isStudent ||
                              (isStudent &&
                                (g.membros ?? []).some(
                                  (m) => String(m.ra) === String(perfil.ra)
                                ))) && (
                              <button onClick={() => startEdit(g)}>
                                Editar
                              </button>
                            )}

                            <button
                              onClick={() =>
                                navigate(`/grupos/atividade/${g.id}`)
                              }
                              className="btn-secondary"
                            >
                              Doações
                            </button>

                            {isMentorLike && (
                              <button
                                onClick={() => askDelete(g)}
                                className="btn-danger"
                              >
                                Excluir
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Form de Edição */}
              {editId && (
                <div className="form-card" style={{ marginTop: 16 }}>
                  <h2>Editar Grupo</h2>
                  <form onSubmit={onSave}>
                    <div className="form-group">
                      <label htmlFor="enome">Nome do Grupo</label>
                      <input
                        id="enome"
                        type="text"
                        value={editForm.nome}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, nome: e.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Membros do Grupo</label>
                      {editMembers.map((m, i) => (
                        <div key={i} className="member-input-group">
                          <input
                            type="text"
                            value={m.nome}
                            onChange={(e) => {
                              const cp = [...editMembers];
                              cp[i] = { ...cp[i], nome: e.target.value };
                              setEditMembers(cp);
                            }}
                            placeholder="Nome"
                            required
                            disabled={
                              !isStudent
                                ? !isStudent
                                : i === 0
                                ? !isStudent
                                : false
                            }
                          />
                          <input
                            type="text"
                            value={m.ra}
                            onChange={(e) => {
                              const cp = [...editMembers];
                              cp[i] = { ...cp[i], ra: e.target.value };
                              setEditMembers(cp);
                            }}
                            placeholder="RA"
                            required
                            disabled={
                              !isStudent
                                ? !isStudent
                                : i === 0
                                ? !isStudent
                                : false
                            }
                          />
                          <input
                            type="tel"
                            value={m.telefone}
                            onChange={(e) => {
                              const cp = [...editMembers];
                              cp[i] = { ...cp[i], telefone: e.target.value };
                              setEditMembers(cp);
                            }}
                            placeholder="Telefone (opcional)"
                            disabled={!isStudent}
                          />
                          {editMembers.length > 1 && !isStudent && (
                            <button
                              type="button"
                              className="btn-danger-small"
                              title="Remover"
                              onClick={() => {
                                const cp = [...editMembers];
                                cp.splice(i, 1);
                                setEditMembers(cp);
                              }}
                            >
                              X
                            </button>
                          )}
                        </div>
                      ))}

                      {isStudent && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            setEditMembers((prev) => [
                              ...prev,
                              { nome: "", ra: "", telefone: "" },
                            ])
                          }
                        >
                          Adicionar Membro
                        </button>
                      )}

                      <div className="paste-row" style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setPasteOpenEdit((o) => !o)}
                        >
                          Colar lista de membros
                        </button>
                        {pasteOpenEdit && (
                          <div className="paste-block">
                            <textarea
                              rows={5}
                              className="input"
                              placeholder={
                                "Um por linha. Ex:\nMaria Silva;12345;1199999-0000\nJoão Souza 54321"
                              }
                              value={pasteTextEdit}
                              onChange={(e) => setPasteTextEdit(e.target.value)}
                            />
                            <div className="form-actions">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={onPasteMembersEdit}
                              >
                                Processar
                              </button>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => {
                                  setPasteTextEdit("");
                                  setPasteOpenEdit(false);
                                }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {!isStudent && (
                      <>
                        <div className="form-group">
                          <label htmlFor="emeta">
                            Meta de Arrecadação (R$)
                          </label>
                          <input
                            id="emeta"
                            type="number"
                            value={editForm.metaArrecadacao}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                metaArrecadacao: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="emetaAl">
                            Meta de Alimentos (Opcional)
                          </label>
                          <input
                            id="emetaAl"
                            type="text"
                            value={editForm.metaAlimentos}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                metaAlimentos: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </>
                    )}

                    <div className="form-group">
                      <label>Imagem de capa</label>
                      {editCapa ? (
                        <div className="cover-preview">
                          <img src={editCapa} alt="Capa do grupo" />
                          <div
                            style={{ display: "flex", gap: 8, marginTop: 8 }}
                          >
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={removeEditCapa}
                            >
                              Remover capa
                            </button>
                          </div>
                        </div>
                      ) : (
                        <input
                          ref={editCapaRef}
                          type="file"
                          accept="image/*"
                          onChange={onPickEditCapa}
                        />
                      )}
                    </div>

                    <div className="form-actions">
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={saving}
                      >
                        {saving ? "Salvando…" : "Salvar Alterações"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setEditId(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal de confirmação */}
      {confirm.open && (
        <div
          className="modal-overlay"
          onClick={() => setConfirm({ open: false, id: null, name: "" })}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Excluir grupo</h3>
              <button
                className="btn btn-ghost"
                onClick={() => setConfirm({ open: false, id: null, name: "" })}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              Tem certeza que deseja excluir o grupo{" "}
              <strong>{confirm.name}</strong>? Esta ação não pode ser desfeita.
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setConfirm({ open: false, id: null, name: "" })}
              >
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={doDelete}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos inline pequenos para ajustar avatar (mantidos do original) */}
      <style>{`
        .mentor-avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; display: inline-block; border: 2px solid rgba(255,255,255,0.06); }
        .mentor-pill { display:flex; align-items:center; gap:8px; }
        .mentor-name { font-size: 0.95rem; margin-left: 4px; }
        .cover-preview img { max-width: 240px; max-height: 120px; display:block; border-radius:8px; object-fit:cover; }
        .member-input-group { display:flex; gap:8px; margin-bottom:8px; align-items:center; }
        .grupo-item { display:flex; gap:12px; padding:12px; border-radius:8px; background:#fff; align-items:flex-start; box-shadow:0 1px 3px rgba(0,0,0,0.04); margin-bottom:10px; }
        .grupo-cover img { width:100px; height:80px; object-fit:cover; border-radius:6px; }
        .cover-ph { width:100px; height:80px; display:flex; align-items:center; justify-content:center; background:#f2f2f2; border-radius:6px; color:#666; }
        /* Removido o .progress-bar-container e .progress-bar-fill daqui pois foram adicionados ao CSS */
        .chip { display:inline-block; padding:2px 8px; border-radius:999px; font-size:.75rem; border:1px solid #b7e4c7; margin-right:4px; }
        .chip-success { background:#d4edda; color:#155724; border-color:#c3e6cb; }
        .chip-progress { background:#e2e3e5; color:#383d41; border-color:#d6d8db; }
        .chip-neutral { background:#f8f9fa; color:#212529; border-color:#dee2e6; }
        .chip-mentor { background:#d1ecf1; color:#0c5460; border-color:#bee5eb; }
        .chip-warn { background:#fff3cd; color:#856404; border-color:#ffeeba; }
        .chip-info { background:#d1e7ff; color:#084298; border-color:#b6d4fe; }
        .title-row { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap; }
        .badges { margin-bottom:8px; }
        .sk-row { height:30px; background:linear-gradient(90deg, #eee 25%, #ddd 50%, #eee 75%); background-size:200% 100%; animation:sk-pulse 1.5s infinite ease-in-out; border-radius:8px; margin-bottom:12px; }
        @keyframes sk-pulse { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
      `}</style>
    </div>
  );
}
