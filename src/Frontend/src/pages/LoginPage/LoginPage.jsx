// src/pages/LoginPage/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./LoginPage.css";
import { FaUser, FaLock, FaIdCard } from "react-icons/fa";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loginMethod, setLoginMethod] = useState("email"); // 'email' | 'ra'
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Lideranças Embaticas • Login";
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();

    if (loginMethod === "email") {
      // ADMIN (FANTASMA): sem necessidade de dados
      if (identifier === "admin@test.com" && password === "123456") {
        setMessage("✅ Login realizado com sucesso! (admin)");
        localStorage.setItem("auth", "true");
        localStorage.setItem(
          "perfil",
          JSON.stringify({
            id: Date.now(),
            tipo: "adm",      // Admin "fantasma"
            nome: "",
            email: "",
            ra: "",
            telefone: "",
            fotoUrl: "",
            preferencias: { tema: "escuro", linguagem: "pt-BR", notificacoesEmail: true },
          })
        );
        setTimeout(() => navigate("/painel"), 800);
        return;
      }

      // MENTOR (exemplo)
      if (identifier === "mentor@test.com" && password === "123456") {
        setMessage("✅ Login realizado com sucesso! (mentor)");
        localStorage.setItem("auth", "true");
        localStorage.setItem(
          "perfil",
          JSON.stringify({
            id: Date.now(),
            tipo: "mentor",
            nome: "Mentor Teste",
            email: identifier,
            ra: "",
            telefone: "(11) 90000-0000",
            fotoUrl: "",
            preferencias: { tema: "escuro", linguagem: "pt-BR", notificacoesEmail: true },
          })
        );
        setTimeout(() => navigate("/painel"), 800);
        return;
      }

      // ALUNO por e-mail (exemplo)
      if (identifier === "aluno@test.com" && password === "123456") {
        setMessage("✅ Login realizado com sucesso! (aluno)");
        localStorage.setItem("auth", "true");
        localStorage.setItem(
          "perfil",
          JSON.stringify({
            id: Date.now(),
            tipo: "aluno",
            nome: "Aluno Teste",
            email: identifier, // opcional
            ra: "12345",       // obrigatório (mock)
            telefone: "",
            fotoUrl: "",
            preferencias: { tema: "escuro", linguagem: "pt-BR", notificacoesEmail: true },
          })
        );
        setTimeout(() => navigate("/painel"), 800);
        return;
      }
    }

    // ALUNO por RA
    if (loginMethod === "ra") {
      if (identifier === "12345" && password === "123456") {
        setMessage("✅ Login realizado com sucesso! (aluno)");
        localStorage.setItem("auth", "true");
        localStorage.setItem(
          "perfil",
          JSON.stringify({
            id: Date.now(),
            tipo: "aluno",
            nome: "Aluno Teste RA",
            email: "",          // opcional
            ra: identifier,     // obrigatório
            telefone: "",       // opcional
            fotoUrl: "",
            preferencias: { tema: "escuro", linguagem: "pt-BR", notificacoesEmail: true },
          })
        );
        setTimeout(() => navigate("/painel"), 800);
        return;
      }
    }

    setMessage("❌ Email/RA ou senha incorretos!");
  };

  const isSuccess = message.toLowerCase().includes("sucesso");

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Bem-vindo!</h1>
        <p className="login-subtitle">Faça login para continuar</p>

        {/* Alternância de método (Email/RA) */}
        <div className="login-method-toggle">
          <button
            type="button"
            className={`toggle-btn ${loginMethod === "email" ? "active" : ""}`}
            onClick={() => {
              setLoginMethod("email");
              setIdentifier("");
              setMessage("");
            }}
          >
            Usar Email
          </button>
          <button
            type="button"
            className={`toggle-btn ${loginMethod === "ra" ? "active" : ""}`}
            onClick={() => {
              setLoginMethod("ra");
              setIdentifier("");
              setMessage("");
            }}
          >
            Usar RA
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="login-form">
          {/* Campo Email/RA */}
          <div className="input-group">
            <label>{loginMethod === "ra" ? "RA (Registro do Aluno)" : "Email"}</label>
            <div className="input-icon">
              <span className="icon">
                {loginMethod === "ra" ? <FaIdCard /> : <FaUser />}
              </span>
              <input
                type={loginMethod === "ra" ? "text" : "email"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={loginMethod === "ra" ? "Ex.: 12345" : "voce@exemplo.com"}
                required
              />
            </div>
          </div>

          {/* Campo Senha */}
          <div className="input-group">
            <label>Senha</label>
            <div className="input-icon">
              <span className="icon"><FaLock /></span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                required
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

          {/* Botão Entrar */}
          <button type="submit" className="login-btn">Entrar</button>

          {/* Mensagem de feedback */}
          {message && (
            <p
              className="login-message"
              style={{ color: isSuccess ? "#2e7d32" : "#e53935" }}
            >
              {message}
            </p>
          )}
        </form>

        {/* Links */}
        <div className="login-links">
          <Link to="#" onClick={(e) => e.preventDefault()}>Esqueci minha senha</Link>
          <Link to="/register" onClick={(e) => e.preventDefault()}>Criar conta</Link>
        </div>
      </div>
    </div>
  );
}
