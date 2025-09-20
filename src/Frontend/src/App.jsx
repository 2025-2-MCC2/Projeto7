// src/App.jsx
import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
  Navigate,
} from 'react-router-dom';

import './styles/theme.css'; // <- se ainda não existe, posso enviar

import Header from './components/Header.jsx';
import SectionHero from './components/SectionHero.jsx';
import MetricCard from './components/MetricCard.jsx';
import LoginPage from './pages/LoginPage/LoginPage.jsx';
import Footer from './components/footer.jsx';
import PainelInicial from './pages/PainelInicial/PainelInicial.jsx';
import Dashboard from "./components/Dashboard.jsx";
import RegisterPage from './pages/RegisterPage/Registerpage.jsx'; // mantém minúsculo
import Grupos from './pages/Grupos/Grupos.jsx';
import PerfilPage from './pages/Perfil/PerfilPage.jsx'; // <-- ADICIONADO

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

// Página pública (Home) — SEM Footer interno (evita duplicidade)
function HomePage() {
  useEffect(() => {
    document.title = 'Lideranças Empáticas • Início';
  }, []);

  return (
    <div className="page">
      <Header />
      <main className="container">
        <SectionHero />

        <MetricCard layout="leftText"  bg="var(--green-700)" image={img1} value={87763} unit="Kg"
          subtitle="Em arrecadações" kicker="Mais de" imageAlt="Equipe com doações em um evento comunitário" />
        <MetricCard layout="rightText" bg="var(--green-800)" image={img2} value={7800}
          subtitle="Pessoas alimentadas durante 1 mês" imageAlt="Voluntários com cestas básicas e alimentos" />
        <MetricCard layout="leftText"  bg="var(--green-700)" image={img3} value={1950}
          subtitle="Famílias alimentadas durante 1 mês" imageAlt="Ação de distribuição de alimentos" />
        <MetricCard layout="rightText" bg="var(--green-800)" image={img4} value={1600}
          subtitle="Alunos participantes" kicker="Mais de" imageAlt="Grupo de estudantes participantes do projeto" />
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

// Guardião de rotas privadas (painel, grupos, perfil, dashboard)
function RequireAuth({ children }) {
  const isAuthed = !!localStorage.getItem('auth');
  return isAuthed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Router>
      <ThemeBoot />
      <Routes>
        {/* Rotas Públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registrar" element={<RegisterPage />} />

        {/* Home com Footer (único) */}
        <Route element={<LayoutComFooter />}>
          <Route path="/" element={<HomePage />} />
        </Route>

        {/* Rotas Protegidas (sem Footer) */}
        <Route
          path="/painel"
          element={
            <RequireAuth>
              <PainelInicial />
            </RequireAuth>
          }
        />
        <Route
          path="/grupos"
          element={
            <RequireAuth>
              <Grupos />
            </RequireAuth>
          }
        />
        <Route
          path="/perfil"       // <-- ADICIONADO: perfil agora aparece
          element={
            <RequireAuth>
              <PerfilPage />
            </RequireAuth>
          }
        />
        {/* (Opcional) Se quiser expor Dashboard avulso: */}
        {/* <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        /> */}

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
