// src/pages/ForgotPasswordPage/ForgotPasswordPage.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEnvelope, FaArrowLeft } from "react-icons/fa";
import { motion } from "framer-motion"; // Para a animação
import { api } from "../../auth/api.js"; 
import "./ForgotPasswordPage.css"; 
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Lideranças Empáticas • Redefinir Senha";
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      // 2. Chama o novo endpoint do backend
      await api.post("/auth/request-reset", { email });

      // Sucesso!
      setMessage(
        "Se este e-mail estiver cadastrado, um link de redefinição será enviado. Por favor, verifique sua caixa de entrada."
      );
      setEmail(""); // Limpa o campo
    } catch (err) {
      const msg =
        err?.response?.data?.error || "Erro ao processar a solicitação.";
      // Por segurança, mesmo em caso de erro, mostramos a msg genérica
      setMessage(
        "Se este e-mail estiver cadastrado, um link de redefinição será enviado. Por favor, verifique sua caixa de entrada."
      );
      console.error("Erro no request-reset:", msg);
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = !!message;

  return (
    <div className="forgot-password-container">
      {/* 1. Animação de fade-in e slide-up usando framer-motion */}
      <motion.div
        className="forgot-password-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        <h1 className="forgot-password-title">Esqueceu sua senha?</h1>
        <p className="forgot-password-subtitle">
          Sem problemas! Digite seu e-mail abaixo e enviaremos um link para
          você criar uma nova.
        </p>

        {/* 3. Lógica de exibição: mostra o formulário OU a msg de sucesso */}
        {!isSuccess ? (
          <form onSubmit={handleSubmit} className="forgot-password-form">
            <div className="input-group">
              <label htmlFor="email">E-mail</label>
              <div className="input-icon">
                <span className="icon">
                  <FaEnvelope />
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <button
              type="submit"
              className="forgot-password-btn"
              disabled={loading}
            >
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </button>
          </form>
        ) : (
          <div className="forgot-password-message success">
            <p>{message}</p>
          </div>
        )}

        {error && !isSuccess && (
          <div className="forgot-password-message error">
            <p>{error}</p>
          </div>
        )}

        <div className="forgot-password-links">
          <Link to="/login">
            <FaArrowLeft style={{ marginRight: "5px" }} />
            Lembrou a senha? Voltar ao Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
