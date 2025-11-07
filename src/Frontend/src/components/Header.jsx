// src/components/Header.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';

export default function Header({ showCTA = true }) {
  const navigate = useNavigate();

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          {/* Marca (logo + textos) */}
          <div
            className="brand"
            onClick={() => navigate('/')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/')}
          >
            <img
              src={logo}
              alt="Lideranças Empáticas - logotipo"
              className="brand__logo"
            />
            <div className="brand__text">
              <h1 className="brand__title">Lideranças Empáticas</h1>
              <p className="brand__subtitle">Educar e desenvolver competências.</p>
            </div>
          </div>

          {/* Direita: Login (ghost, discreto) */}
          <nav className="header__actions" aria-label="Ações principais">
            <button
              className="btn btn-pill btn--ghost"
              onClick={() => navigate('/login')}
            >
              Login
            </button>
          </nav>
        </div>
      </header>

      {/* Faixa abaixo do header com CTA destacado */}
      {showCTA && (
        <div className="header-cta-bar">
          <button
            className="btn btn-pill cta-resultados"
            onClick={() => navigate('/resultados')}
            aria-label="Ver resultados do projeto"
            title="Ver resultados do projeto"
          >
            <span className="cta-icon" aria-hidden="true">📊</span>
            <span>Resultados do Projeto</span>
          </button>
        </div>
      )}
    </>
  );
}