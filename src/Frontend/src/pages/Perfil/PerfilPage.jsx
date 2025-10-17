// src/pages/Perfil/PerfilPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PerfilPage.css";

// Lê o objeto 'perfil' salvo no login/configurações
const loadPerfil = () => {
  try { return JSON.parse(localStorage.getItem("perfil") || "{}"); } catch { return {}; }
};
const savePerfil = (p) => localStorage.setItem("perfil", JSON.stringify(p));

const getInitial = (nome = "Usuário") => String(nome).trim()?.[0]?.toUpperCase() || "U";

export default function PerfilPage() {
  const navigate = useNavigate();

  const [perfil, setPerfil] = useState(() => loadPerfil());
  const [copied, setCopied] = useState(false);

  // Upload state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const dropRef = useRef(null);
  const fileRef = useRef(null);

  // Reflete alterações vindas de Configurações (outra aba/guia)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "perfil") {
        try { setPerfil(JSON.parse(e.newValue || "{}")); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Status visual (apenas ilustração)
  const statusTxt = useMemo(() => {
    try {
      const s = JSON.parse(localStorage.getItem("app_settings_v2") || "{}");
      const mode = s?.status?.mode;
      if (mode === "ausente") return "ausente";
      return "online";
    } catch { return "online"; }
  }, [perfil]);

  const nome  = perfil?.nome  || "Usuário";
  const email = perfil?.email || "—";
  const foto  = perfil?.fotoUrl || "";

  // ===== Utilidades de validação/conversão =====
  const isImageFile = (file) => file && file.type?.startsWith("image/");
  const isAcceptableSize = (file, maxMB = 3) => file && file.size <= maxMB * 1024 * 1024;
  const isValidImageUrl = (u) => {
    try {
      const url = new URL(u);
      return /^https?:$/i.test(url.protocol);
    } catch { return false; }
  };
  const fileToDataURL = (file) => new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result));
    rd.onerror = reject;
    rd.readAsDataURL(file);
  });

  // ===== Persistência local de foto =====
  const persistLocalPhoto = (fotoUrl) => {
    const novo = { ...perfil, fotoUrl };
    setPerfil(novo);
    savePerfil(novo);
  };

  // ===== Upload de arquivo (frontend) =====
  const handleSelectFile = async (e) => {
    setError("");
    const f = e?.target?.files?.[0];
    if (!f) return;
    if (!isImageFile(f)) return setError("Selecione um arquivo de imagem.");
    if (!isAcceptableSize(f, 5)) return setError("Tamanho máximo: 5MB.");

    setBusy(true);
    try {
      const dataUrl = await fileToDataURL(f); // preview imediato (frontend)
      persistLocalPhoto(dataUrl);

      // ====== BACKEND (comentado) ======
      /*
      const fd = new FormData();
      fd.append('photo', f);
      // Se precisar do id/ra: fd.append('userId', perfil.ra || perfil.nome || 'anon');
      const r = await fetch('/api/profile/photo', { method: 'POST', body: fd });
      if (!r.ok) throw new Error('Falha ao enviar foto');
      const { url } = await r.json(); // a API retorna a URL pública
      persistLocalPhoto(url); // troca o dataURL pela URL do backend
      */
    } catch (err) {
      setError(err?.message || "Não foi possível carregar a imagem.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ===== Cole/solte (drag & drop) =====
  const onDrop = async (ev) => {
    ev.preventDefault();
    setError("");
    const f = ev.dataTransfer?.files?.[0];
    if (!f) return;
    if (!isImageFile(f)) return setError("Solte apenas arquivos de imagem.");
    if (!isAcceptableSize(f, 5)) return setError("Tamanho máximo: 5MB.");

    setBusy(true);
    try {
      const dataUrl = await fileToDataURL(f);
      persistLocalPhoto(dataUrl);

      // BACKEND (comentado) — igual ao handleSelectFile
      /*
      const fd = new FormData();
      fd.append('photo', f);
      const r = await fetch('/api/profile/photo', { method: 'POST', body: fd });
      if (!r.ok) throw new Error('Falha ao enviar foto');
      const { url } = await r.json();
      persistLocalPhoto(url);
      */
    } catch (e) {
      setError(e?.message || "Erro ao processar a imagem.");
    } finally {
      setBusy(false);
    }
  };
  const preventDefault = (ev) => ev.preventDefault();

  // ===== Vincular por URL =====
  const handleLinkSave = async () => {
    setError("");
    const u = (urlInput || "").trim();
    if (!u) return setError("Informe uma URL.");
    if (!isValidImageUrl(u)) return setError("URL inválida. Use http(s) e verifique o formato.");
    setBusy(true);
    try {
      // preview imediato (front): persiste a URL
      persistLocalPhoto(u);

      // BACKEND (comentado): notifica o servidor para validar/baixar a imagem
      /*
      const r = await fetch('/api/profile/photo-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u, userId: perfil.ra || perfil.nome || 'anon' })
      });
      if (!r.ok) throw new Error('Falha ao vincular URL de imagem');
      const { url } = await r.json();
      persistLocalPhoto(url); // caso o backend normalize/otimize a URL
      */
      setUrlInput("");
    } catch (e) {
      setError(e?.message || "Erro ao vincular URL de imagem.");
    } finally {
      setBusy(false);
    }
  };

  // ===== Remover foto =====
  const handleRemovePhoto = async () => {
    setError("");
    setBusy(true);
    try {
      // FRONT: remove local
      persistLocalPhoto("");

      // BACKEND (comentado): remove a foto no servidor/CDN
      /*
      const r = await fetch('/api/profile/photo', { method: 'DELETE' });
      if (!r.ok) throw new Error('Falha ao remover foto no servidor');
      */
    } catch (e) {
      setError(e?.message || "Erro ao remover foto.");
    } finally {
      setBusy(false);
    }
  };

  // ===== Copiar e-mail =====
  const onCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="perfil-container perfil-view">
      <div className="perfil-card perfil-card--view" role="region" aria-label="Meu perfil">
        <div className="perfil-header">
          <h1>Meu perfil</h1>
          <span className="perfil-badge" aria-live="polite">{statusTxt}</span>
        </div>

        {/* Topo: avatar + identificação */}
        <div className="perfil-view__top">
          <div className="perfil-avatar-ring" aria-hidden="true" />
          <div className="perfil-avatar-wrap">
            {foto ? (
              <img src={foto} alt="Foto do perfil" className="perfil-avatar perfil-avatar--lg" />
            ) : (
              <div className="perfil-avatar perfil-avatar--lg perfil-avatar--placeholder" aria-hidden="true">
                {getInitial(nome)}
              </div>
            )}
            <span className={`presence-dot ${statusTxt === "ausente" ? "away" : "online"}`} aria-hidden="true" />
          </div>

          <div className="perfil-view__id">
            <h2 title={nome} className="perfil-view__name">{nome}</h2>
            <p className="perfil-view__email" title={email}>
              <i className="fa-regular fa-envelope" aria-hidden="true"></i> {email}
            </p>
          </div>
        </div>

        {/* Controles da foto (upload + link) */}
        <div className="perfil-upload">
          <div
            ref={dropRef}
            className={`dropzone ${busy ? "is-busy" : ""}`}
            onDragOver={preventDefault}
            onDragEnter={preventDefault}
            onDragLeave={preventDefault}
            onDrop={onDrop}
            aria-label="Área para soltar imagem"
            tabIndex={0}
          >
            <div className="dz-icon" aria-hidden="true"><i className="fa-regular fa-image"></i></div>
            <div className="dz-text">
              Arraste e solte sua foto aqui, ou
              <button
                className="link"
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                selecione do dispositivo
              </button>.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleSelectFile}
              aria-label="Selecionar arquivo de imagem"
            />
          </div>

          <div className="or-sep"><span>ou</span></div>

          <div className="link-row">
            <input
              className="perfil-input"
              type="url"
              placeholder="Cole um link de imagem (https://...)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={busy}
            />
            <button className="perfil-btn perfil-btn--secondary" onClick={handleLinkSave} disabled={busy || !urlInput.trim()}>
              <i className="fa-solid fa-link" aria-hidden="true"></i> Usar link
            </button>
          </div>

          <div className="foto-actions">
            <button className="perfil-btn perfil-btn--danger" onClick={handleRemovePhoto} disabled={busy || !foto}>
              <i className="fa-regular fa-trash-can" aria-hidden="true"></i> Remover foto
            </button>
          </div>

          {error && <p className="perfil-msg error" role="alert">{error}</p>}
          {busy && <p className="perfil-msg" role="status">Processando…</p>}
        </div>

        {/* Informações somente leitura */}
        <div className="perfil-info">
          <div className="perfil-info__row">
            <span className="perfil-info__label">Nome</span>
            <span className="perfil-info__value" title={nome}>{nome}</span>
          </div>
          <div className="perfil-info__row">
            <span className="perfil-info__label">E‑mail</span>
            <span className="perfil-info__value" title={email}>{email}</span>
          </div>
        </div>

        {/* Ações gerais */}
        <div className="perfil-actions">
          <button type="button" className="perfil-btn perfil-btn--ghost" onClick={() => navigate(-1)}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Voltar
          </button>
          <button type="button" className="perfil-btn perfil-btn--secondary" onClick={onCopyEmail}
                  title="Copiar e‑mail para a área de transferência">
            <i className="fa-regular fa-copy" aria-hidden="true"></i>
            {copied ? "Copiado!" : "Copiar e‑mail"}
          </button>
          <a className="perfil-btn perfil-btn--secondary" href={`mailto:${email}`}>
            <i className="fa-regular fa-envelope" aria-hidden="true"></i> Enviar e‑mail
          </a>
          <button
            type="button"
            className="perfil-btn perfil-btn--primary"
            onClick={() => navigate("/config")}
            title="Editar informações nas Configurações"
          >
            <i className="fa-solid fa-gear" aria-hidden="true"></i> Configurações
          </button>
        </div>
      </div>
    </div>
  );
}