// src/App.jsx
import React, { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
} from 'react-router-dom';
import axios from 'axios'; 

// Estilos globais do projeto (sem tokens.css)
import './styles/styles.css';
import './styles/theme.css';

// Autenticação / proteção de rotas
import { AuthProvider } from './auth/AuthProvider.jsx';
import ProtectedRoute from './auth/ProtectedRoute';

// Layout compartilhado
import Footer from './components/footer.jsx';

// Páginas públicas
import Home from './pages/HomePage/Home.jsx';
import Resultados from './pages/Resultados/Resultados.jsx';     // <— nova aba pública
import Error404 from './pages/Error404Page/Error404.jsx';
import LoginPage from './pages/LoginPage/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage/Registerpage.jsx';

// Páginas protegidas
import PainelInicial from './pages/PainelInicial/PainelInicial.jsx';
import Grupos from './pages/Grupos/Grupos.jsx';
import PerfilPage from './pages/Perfil/PerfilPage.jsx';
import Relatorios from './pages/Relatorios/Relatorios.jsx';
import AtividadesGrupo from './pages/Grupos/DoacaoGrupo.jsx';
import Configuracoes from './pages/Configuracoes/Configuracoes.jsx';
import { api } from './auth/api.js';



axios.defaults.withCredentials = true;
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';



/** Aplica o tema salvo no perfil ao iniciar o app */
function ThemeBoot() {
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('perfil') || '{}');
      const tema = p?.preferencias?.tema === 'escuro' ? 'escuro' : 'claro';
      document.documentElement.setAttribute('data-theme', tema);
    } catch {
      document.documentElement.setAttribute('data-theme', 'claro');
    }
  }, []);
  return null;
}

const getUserId = () => {
  try {
    const raw = localStorage.getItem('perfil');
    const p = raw ? JSON.parse(raw) : {};
    return String(p.ra || p.nome || 'anon');
  } catch {
    return 'anon';
  }
};

// Layout com Footer único para páginas públicas
function LayoutComFooter() {
  return (
    <>
      <Outlet />
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ThemeBoot />
        <Routes>
          {/* Rotas públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registrar" element={<RegisterPage />} />

          {/* Home + Resultados com Footer único */}
          <Route element={<LayoutComFooter />}>
            <Route path="/" element={<Home />} />
            <Route path="/resultados" element={<Resultados />} />
          </Route>

          {/* Rotas protegidas */}
          <Route
            path="/painel"
            element={
              <ProtectedRoute>
                <PainelInicial />
              </ProtectedRoute>
            }
          />
          <Route
            path="/grupos"
            element={
              <ProtectedRoute>
                <Grupos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <PerfilPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/config"
            element={
              <ProtectedRoute>
                <Configuracoes userId={getUserId()} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/relatorios"
            element={
              <ProtectedRoute>
                <Relatorios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/grupos/doacoes/:id"
            element={
              <ProtectedRoute>
                <AtividadesGrupo />
              </ProtectedRoute>
            }
          />

          {/* Fallback 404 */}
          <Route path="*" element={<Error404 />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}