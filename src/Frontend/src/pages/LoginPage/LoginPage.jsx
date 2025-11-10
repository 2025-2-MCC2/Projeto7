// src/pages/LoginPage/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom"; // 1. useNavigate ainda é usado
import "./LoginPage.css";
// import axios from "axios"; // 2. REMOVEMOS o axios global
import { api } from "../../auth/api"; // 3. IMPORTAMOS a instância 'api'
import { useAuth } from "../../auth/useAuth"; // 4. IMPORTAMOS o useAuth
import { FaUser, FaLock, FaIdCard } from "react-icons/fa";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";

/**
 * Segurança & Modo Teste:
 // ... (comentários existentes) ...
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
  // const API = import.meta.env.VITE_API_URL || ""; // REMOVIDO (api.js cuida disso)

  // 5. PEGAMOS O setPerfil DO CONTEXTO GLOBAL
  const { setPerfil } = useAuth();

  // 6. Esta linha não é mais necessária aqui, está no api.js e App.jsx
  // axios.defaults.withCredentials = AUTH_STORAGE === "cookie"; 

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
      const admProfile = upsertPerfil({ tipo: "adm", nome: "Administrador", email: identifier, ra: "", fotoUrl: "" });
      setUsedLocalFallback(true);
      return { tipo: "adm", perfil: admProfile }; // Retorna o perfil
    }

    // Mentor
    if (loginMethod === "email" && identifier === "mentor@test.com" && password === "123456") {
      const u = { id: 1, tipo: "mentor", nome: "Mentor Teste", email: identifier, ra: "", fotoUrl: "" };
      if (AUTH_STORAGE === "local") localStorage.setItem("auth", "true");
      localStorage.setItem("ultimoLogin", JSON.stringify(u));
      const mentorProfile = upsertPerfil({ tipo: u.tipo, nome: u.nome, email: u.email, ra: "", fotoUrl: u.fotoUrl });
      setUsedLocalFallback(true);
      return { tipo: "mentor", perfil: mentorProfile }; // Retorna o perfil
    }

    // Aluno
    if (loginMethod === "ra" && identifier === "12345" && password === "123456") {
      const u = { id: 2, tipo: "aluno", nome: "Aluno Teste", email: "", ra: identifier, fotoUrl: "" };
      if (AUTH_STORAGE === "local") localStorage.setItem("auth", "true");
      localStorage.setItem("ultimoLogin", JSON.stringify(u));
      const alunoProfile = upsertPerfil({ tipo: u.tipo, nome: u.nome, email: "", ra: u.ra, fotoUrl: u.fotoUrl });
      setUsedLocalFallback(true);
      return { tipo: "aluno", perfil: alunoProfile }; // Retorna o perfil
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
      // 7. Usamos a instância 'api' e a rota relativa
      const resp = await api.post(`/auth/login`, {
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
        const admProfile = upsertPerfil({ tipo: "adm", nome: u.nome || "Administrador", email: u.email || "", ra: "", fotoUrl: "" });
        
        // 8. ATUALIZA O ESTADO GLOBAL *ANTES* DE NAVEGAR
        setPerfil(admProfile);

        // 9. NAVEGA IMEDIATAMENTE (sem setTimeout)
        navigate("/painel");
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

      // 10. ATUALIZA O ESTADO GLOBAL *ANTES* DE NAVEGAR
      setPerfil(perfilNovo);

      // 11. NAVEGA IMEDIATAMENTE (sem setTimeout)
      navigate("/painel");

    } catch (err) {
      // Fallback local (modo teste)
      const test = tryLocalLogin();
      if (test && test.perfil) {
        // 12. ATUALIZA O ESTADO GLOBAL (para o fallback)
        setPerfil(test.perfil);
        // 13. NAVEGA IMEDIATAMENTE (sem setTimeout)
        navigate("/painel");
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
  const isSuccess = message.startsWith("✅"); // Agora só mostrará erros

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

          {message && ( // 14. O 'message' agora só exibirá ERROS
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