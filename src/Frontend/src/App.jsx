// src/App.jsx
import React, { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  Navigate,
} from 'react-router-dom';

import './styles/theme.css';

import { AuthProvider } from './auth/AuthProvider.jsx';
import ProtectedRoute from './auth/ProtectedRoute';

import Header from './components/Header.jsx';
import SectionHero from './components/SectionHero.jsx';
import MetricCard from './components/MetricCard.jsx';
import LoginPage from './pages/LoginPage/LoginPage.jsx';
import Footer from './components/footer.jsx';
import PainelInicial from './pages/PainelInicial/PainelInicial.jsx';
// import Dashboard from './components/Dashboard.jsx'; // (opcional) use se tiver rota dedicada
import RegisterPage from './pages/RegisterPage/Registerpage.jsx';
import Grupos from './pages/Grupos/Grupos.jsx';
import PerfilPage from './pages/Perfil/PerfilPage.jsx';
import Relatorios from './pages/Relatorios/Relatorios.jsx';
import AtividadesGrupo from './pages/Grupos/DoacaoGrupo.jsx';
import Configuracoes from './pages/Configuracoes/Configuracoes.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage/ForgotPasswordPage.jsx';

import img1 from './assets/img1.jpg';
import img2 from './assets/img2.jpg';
import img3 from './assets/img3.jpg';
import img4 from './assets/img4.jpg';

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

// Página pública (Home) — sem Footer dentro; o Footer vem do Layout
function HomePage() {
  useEffect(() => {
    document.title = 'Lideranças Empáticas • Início';
  }, []);

  return (
    <div className="page">
      <Header />
      <main className="container">
        <SectionHero />

        <MetricCard
          layout="leftText"
          bg="var(--green-700)"
          image={img1}
          value={87763}
          unit="Kg"
          subtitle="Em arrecadações"
          kicker="Mais de"
          imageAlt="Equipe com doações em um evento comunitário"
        />
        <MetricCard
          layout="rightText"
          bg="var(--green-800)"
          image={img2}
          value={7800}
          subtitle="Pessoas alimentadas durante 1 mês"
          imageAlt="Voluntários com cestas básicas e alimentos"
        />
        <MetricCard
          layout="leftText"
          bg="var(--green-700)"
          image={img3}
          value={1950}
          subtitle="Famílias alimentadas durante 1 mês"
          imageAlt="Ação de distribuição de alimentos"
        />
        <MetricCard
          layout="rightText"
          bg="var(--green-800)"
          image={img4}
          value={1600}
          subtitle="Alunos participantes"
          kicker="Mais de"
          imageAlt="Grupo de estudantes participantes do projeto"
        />
      </main>
    </div>
  );
}

// Layout com Footer único
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
          <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />

          {/* Home com Footer (único) */}
          <Route element={<LayoutComFooter />}>
            <Route path="/" element={<HomePage />} />
          </Route>

          {/* Rotas PROTEGIDAS */}
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
            path="/grupos/atividade/:id"
            element={
              <ProtectedRoute>
                <AtividadesGrupo />
              </ProtectedRoute>
            }
          />

          {/* (Opcional) Expor Dashboard avulso */}
          {/*
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          */}

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
