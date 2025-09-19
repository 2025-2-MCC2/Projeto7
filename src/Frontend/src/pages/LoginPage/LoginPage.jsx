// src/pages/LoginPage/LoginPage.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom"; // ← Adicionei Link
import "./LoginPage.css";
import { FaUser, FaLock, FaIdCard } from "react-icons/fa";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loginMethod, setLoginMethod] = useState("email"); // 'email' ou 'ra'
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    if (loginMethod === 'email') {
      // Admin/Mentor Login
      if (identifier === "admin@test.com" && password === "123456") {
        setMessage("✅ Login como mentor realizado com sucesso!");
        localStorage.setItem("auth", "true");
        localStorage.setItem("perfil", JSON.stringify({ tipo: "adm", email: identifier, nome: "Admin" }));
        setTimeout(() => navigate("/painel"), 1000);
        return;
      }
      // Aluno Login de Teste
      if (identifier === "aluno@test.com" && password === "123456") {
        setMessage("✅ Login como aluno realizado com sucesso!");
        localStorage.setItem("auth", "true");
        localStorage.setItem("perfil", JSON.stringify({ tipo: "aluno", email: identifier, nome: "Aluno Teste" }));
        setTimeout(() => navigate("/painel"), 1000);
        return;
      }
    }

    if (loginMethod === 'ra') {
      // Aluno Login de Teste com RA
      if (identifier === "12345" && password === "123456") {
      setMessage("✅ Login como aluno realizado com sucesso!");
      localStorage.setItem("auth", "true");
      localStorage.setItem("perfil", JSON.stringify({ tipo: "aluno", ra: identifier, nome: "Aluno Teste RA" }));
      setTimeout(() => navigate("/painel"), 1000);
      return;
    }

    // Falha no login
    setMessage("❌ Email/RA ou senha incorretos!");
  };
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Bem-vindo!</h2>
        <p className="login-subtitle">Faça login para continuar</p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="login-method-toggle">
            <button type="button" className={`toggle-btn ${loginMethod === 'email' ? 'active' : ''}`} onClick={() => { setLoginMethod('email'); setIdentifier(''); }}>Usar Email</button>
            <button type="button" className={`toggle-btn ${loginMethod === 'ra' ? 'active' : ''}`} onClick={() => { setLoginMethod('ra'); setIdentifier(''); }}>Usar RA</button>
          </div>

          <div className="input-group">
            <label>{loginMethod === 'ra' ? 'RA (Registro do Aluno)' : 'Email'}</label>
            <div className="input-icon">
              {loginMethod === 'ra' ? (
                <FaIdCard className="icon" />
              ) : (
                <FaUser className="icon" />
              )}
              <input
                type={loginMethod === 'ra' ? "text" : "email"}
                placeholder={loginMethod === 'ra' ? "Digite seu RA" : "Digite seu email"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Senha</label>
            <div className="input-icon">
              <FaLock className="icon" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <AiFillEyeInvisible /> : <AiFillEye />}
              </span>
            </div>
          </div>

          <button type="submit" className="login-btn">
            Entrar
          </button>

          {message && (
            <p
              className="login-message"
              style={{ color: message.includes("sucesso") ? "#2e7d32" : "#e53935" }}
            >
              {message}
            </p>
          )}

          <div className="login-links">
            <Link to="#">Esqueci minha senha</Link>
            <Link to="/registrar">Criar conta</Link> {/* ← Agora vai para o registro */}
          </div>
        </form>
      </div>
    </div>
  );
} 
