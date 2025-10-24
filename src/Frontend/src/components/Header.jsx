import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import './Header.css';

export default function Header() {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div className="header-inner header-grid">
        {/* Coluna 1: Logo */}
        <img className="brand__logo" src={logo} alt="Logo" />

        {/* Coluna 2: Títulos */}
        <div className="brand__text">
          <h1 className="brand__title">Lideranças Empáticas</h1>
          <p className="brand__subtitle">Educar e desenvolver competências.</p>
        </div>

        {/* Coluna 3: Botão */}
        <nav>
          <button className="btn-pill" onClick={() => navigate('/login')}>
            Login
          </button>
        </nav>
      </div>
    </header>
  );
}