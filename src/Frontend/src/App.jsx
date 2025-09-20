// src/App.jsx
import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from 'react-router-dom';

import './styles/theme.css'; // <-- Tema global

import LoginPage from './pages/LoginPage/LoginPage.jsx';
import PainelInicial from './pages/PainelInicial/PainelInicial.jsx';
import Grupos from './pages/Grupos/Grupos.jsx';
import Dashboard from './components/Dashboard.jsx';
import RegisterPage from './pages/RegisterPage/Registerpage.jsx';
import PerfilPage from './pages/Perfil/PerfilPage.jsx';

function RequireAuth() {
  const isAuthed = !!localStorage.getItem('auth');
  return isAuthed ? <Outlet /> : <Navigate to="/" replace />;
}

/** Aplica o tema salvo no perfil assim que o app carrega */
function ThemeBoot() {
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('perfil') || '{}');
      const tema = p?.preferencias?.tema || 'claro';
      document.documentElement.setAttribute('data-theme', tema === 'escuro' ? 'escuro' : 'claro');
    } catch {
      document.documentElement.setAttribute('data-theme', 'claro');
    }
  }, []);
  return null;
}

export default function App() {
  return (
    <Router>
      <ThemeBoot />
      <Routes>
        {/* Públicas */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protegidas */}
        <Route element={<RequireAuth />}>
          <Route path="/painel" element={<PainelInicial />} />
          <Route path="/grupos" element={<Grupos />} />
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
