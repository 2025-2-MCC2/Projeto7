// src/pages/LoginPage/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./LoginPage.css";
import axios from "axios";
import { FaUser, FaLock, FaIdCard } from "react-icons/fa";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";

/**
 * Segurança & Modo Teste:
 * - VITE_AUTH_STORAGE = 'cookie' | 'local'
 *   'cookie' (padrão): usa JWT em cookie httpOnly (mais seguro).
 *   'local'  (dev): marca "auth" no localStorage (evita depender de cookie em dev).
 * - VITE_ENABLE_LOCAL_TEST_LOGINS = 'true'|'false'
 *   Se 'true', em caso de erro no backend, usa credenciais locais:
 *     mentor@test.com/123456 | 12345/123456 | adm@test.com/admin123
 */
const AUTH_STORAGE = import.meta.env.VITE_AUTH_STORAGE || "cookie";
const ENABLE_LOCAL_TEST = (import.meta.env.VITE_ENABLE_LOCAL_TEST_LOGINS || "false") === "true";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage]       = useState("");
  const [loginMethod, setLoginMethod] = useState("email"); // 'email' | 'ra'
  const [photoUrl, setPhotoUrl]     = useState("");        // exibição (read-only)
  const [submitting, setSubmitting] = useState(false);
  const [usedLocalFallback, setUsedLocalFallback] = useState(false);

  const navigate = useNavigate();
  const API = import.meta.env.VITE_API_URL || "/api";

  axios.defaults.withCredentials = AUTH_STORAGE === "cookie";

  // Carrega perfil/ultimoLogin para foto (visual) e conveniência
  useEffect(() => {
    document.title = "Lideranças Empáticas • Login";
    try {
      const rawPerfil = localStorage.getItem("perfil");
      const rawUltimo = localStorage.getItem("ultimoLogin");
      const perfil = rawPerfil ? JSON.parse(rawPerfil) : null;
      const ultimo = rawUltimo ? JSON.parse(rawUltimo) : null;

      if (perfil?.tipo === "mentor") { setLoginMethod("email"); setIdentifier(perfil.email || ""); }
      else if (perfil?.tipo === "aluno") { setLoginMethod("ra"); setIdentifier(perfil.ra || ""); }
      else if (!perfil && ultimo?.tipo) {
        if (ultimo.tipo === "mentor") { setLoginMethod("email"); setIdentifier(ultimo.email || ""); }
        else if (ultimo.tipo === "aluno") { setLoginMethod("ra"); setIdentifier(ultimo.ra || ""); }
      }

      if (perfil?.fotoUrl) setPhotoUrl(perfil.fotoUrl);
      else if (ultimo?.fotoUrl) setPhotoUrl(ultimo.fotoUrl);
    } catch {}
  }, []);

  const switchMethod = (method) => {
    setLoginMethod(method);
    setIdentifier("");
    setPassword("");
    setMessage("");
  };

  const upsertPerfil = (patch) => {
    try {
      const current = JSON.parse(localStorage.getItem("perfil") || "{}");
      const foto = patch.fotoUrl !== undefined ? patch.fotoUrl : (current.fotoUrl || "");
      const novo = { ...current, ...patch, fotoUrl: foto };
      localStorage.setItem("perfil", JSON.stringify(novo));
      return novo;
    } catch {
      localStorage.setItem("perfil", JSON.stringify({ ...patch }));
      return patch;
    }
  };

  // Fallback local (modo teste) — sem backend
  function tryLocalLogin() {
    if (!ENABLE_LOCAL_TEST) return null;

    // ADM (via email)
    if (loginMethod === "email" && identifier === "adm@test.com" && password === "admin123") {
      if (AUTH_STORAGE === "local") localStorage.setItem("auth", "true");
      try { localStorage.removeItem("ultimoLogin"); } catch {}
      upsertPerfil({ tipo: "adm", nome: "Administrador", email: identifier, ra: "", fotoUrl: "" });
      setUsedLocalFallback(true);
      return { tipo: "adm" };
    }

    // Mentor
    if (loginMethod === "email" && identifier === "mentor@test.com" && password === "123456") {
      const u = { id: 1, tipo: "mentor", nome: "Mentor Teste", email: identifier, ra: "", fotoUrl: "" };
      if (AUTH_STORAGE === "local") localStorage.setItem("auth", "true");
      localStorage.setItem("ultimoLogin", JSON.stringify(u));
      upsertPerfil({ tipo: u.tipo, nome: u.nome, email: u.email, ra: "", fotoUrl: u.fotoUrl });
      setUsedLocalFallback(true);
      return u;
    }

    // Aluno
    if (loginMethod === "ra" && identifier === "12345" && password === "123456") {
      const u = { id: 2, tipo: "aluno", nome: "Aluno Teste", email: "", ra: identifier, fotoUrl: "" };
      if (AUTH_STORAGE === "local") localStorage.setItem("auth", "true");
      localStorage.setItem("ultimoLogin", JSON.stringify(u));
      upsertPerfil({ tipo: u.tipo, nome: u.nome, email: "", ra: u.ra, fotoUrl: u.fotoUrl });
      setUsedLocalFallback(true);
      return u;
    }

    return null;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);
    setUsedLocalFallback(false);

    // Reset "auth" em modo local antes de tentar
    if (AUTH_STORAGE === "local") try { localStorage.removeItem("auth"); } catch {}

    try {
      const resp = await axios.post(`${API}/auth/login`, {
        method: loginMethod,
        identifier,
        senha: password,
      });

      const u = resp?.data?.user;
      if (!u?.tipo) throw new Error("Payload inválido");

      // ADM — não persiste ultimoLogin
      if (u.tipo === "adm") {
        if (AUTH_STORAGE === "local") localStorage.setItem("auth", "true");
        try { localStorage.removeItem("ultimoLogin"); } catch {}
        upsertPerfil({ tipo: "adm", nome: u.nome || "Administrador", email: u.email || "", ra: "", fotoUrl: "" });
        setMessage("✅ Login ADM realizado!");
        setTimeout(() => navigate("/painel"), 350);
        return;
      }

      // Mentor / Aluno — salvam perfil + ultimoLogin (sem senha/token)
      if (AUTH_STORAGE === "local") localStorage.setItem("auth", "true");
      const foto = u.fotoUrl || photoUrl || "";
      const perfilNovo = upsertPerfil({
        tipo: u.tipo, nome: u.nome || "", email: u.email || "", ra: u.ra || "",
        grupoId: u.grupoId || null, grupoNome: u.grupoNome || null, fotoUrl: foto,
      });
      localStorage.setItem("ultimoLogin", JSON.stringify({
        id: u.id, tipo: u.tipo, nome: u.nome || "", email: u.email || "", ra: u.ra || "", fotoUrl: foto,
      }));
      if (perfilNovo.fotoUrl && !photoUrl) setPhotoUrl(perfilNovo.fotoUrl);

      setMessage("✅ Login realizado com sucesso!");
      setTimeout(() => navigate("/painel"), 350);
    } catch (err) {
      // Fallback local (modo teste)
      const test = tryLocalLogin();
      if (test) {
        const msg = test.tipo === "adm" ? "✅ Login ADM (teste local)" : "✅ Login (teste local)";
        setMessage(msg);
        setTimeout(() => navigate("/painel"), 300);
      } else {
        const msg = err?.response?.data?.error || "❌ Login ou senha incorretos!";
        setMessage(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const labelIdentifier = loginMethod === "ra" ? "RA (Registro do Aluno)" : "Email do Mentor";
  const placeholderIdentifier = loginMethod === "ra" ? "Ex.: 12345" : "mentor@exemplo.com";
  const identifierType = loginMethod === "ra" ? "text" : "email";
  const isSuccess = message.startsWith("✅");

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Bem-vindo!</h1>
        <p className="login-subtitle">
          Faça login para continuar
          {usedLocalFallback && ENABLE_LOCAL_TEST ? " • Modo teste (local)" : ""}
        </p>

        {/* FOTO (somente visual; aparece se existir) */}
        {photoUrl ? (
          <div className="photo-preview-wrapper" aria-hidden="true">
            <img src={photoUrl} alt="" className="photo-preview" />
          </div>
        ) : null}

        {/* Alternância de método: Mentor / Aluno */}
        <div className="login-method-toggle">
          <button
            type="button"
            className={`toggle-btn ${loginMethod === "email" ? "active" : ""}`}
            onClick={() => switchMethod("email")}
            title="Login por e-mail"
          >
            Mentor
          </button>
          <button
            type="button"
            className={`toggle-btn ${loginMethod === "ra" ? "active" : ""}`}
            onClick={() => switchMethod("ra")}
            title="Login por RA"
          >
            Aluno
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="login-form" noValidate>
          <div className="input-group">
            <label>{labelIdentifier}</label>
            <div className="input-icon">
              <span className="icon">
                {loginMethod === "ra" ? <FaIdCard /> : <FaUser />}
              </span>
              <input
                type={identifierType}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={placeholderIdentifier}
                required
                inputMode={loginMethod === "ra" ? "numeric" : "email"}
                pattern={loginMethod === "ra" ? "[0-9]*" : undefined}
                autoComplete={loginMethod === "ra" ? "username" : "email"}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Senha</label>
            <div className="input-icon">
              <span className="icon">
                <FaLock />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                required
                autoComplete="current-password"
              />
              <span
                className="toggle-password"
                onClick={() => setShowPassword((s) => !s)}
                role="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <AiFillEyeInvisible /> : <AiFillEye />}
              </span>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={submitting}>
            {submitting ? "Entrando…" : "Entrar"}
            
          </button>

          {message && (
            <p
              className="login-message"
              style={{ color: isSuccess ? "#2e7d32" : "#e53935" }}
              role="status"
              aria-live={isSuccess ? "polite" : "assertive"}
            >
              {message}
            </p>
          )}
        </form>

        <div className="login-links">
          <Link to="#">Esqueci minha senha</Link>
          <Link to="/registrar">Criar conta</Link>
        </div>
      </div>
    </div>
  );
}
