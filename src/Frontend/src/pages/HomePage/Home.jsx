// src/pages/Home/Home.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../../components/Header.jsx';
import SectionHero from '../../components/SectionHero.jsx';
import MetricCard from '../../components/MetricCard.jsx';

import img1 from '../../assets/img1.jpg';
import img2 from '../../assets/img2.jpg';
import img3 from '../../assets/img3.jpg';
import img4 from '../../assets/img4.jpg';

/* === Hook: precarregar imagens (opcional, deixa a experiência suave) === */
function usePreloadImages(urls = []) {
  const [loaded, setLoaded] = useState({});
  useEffect(() => {
    let mounted = true;
    urls.forEach((url) => {
      const im = new Image();
      im.onload = () => mounted && setLoaded((s) => ({ ...s, [url]: true }));
      im.onerror = () => mounted && setLoaded((s) => ({ ...s, [url]: false }));
      im.src = url;
    });
    return () => { mounted = false; };
  }, [urls.join('|')]);
  return loaded; // { [url]: boolean }
}

/* === Tela de Loading com animação dos cabos (no mesmo arquivo) === */
function LoadingOverlay() {
  return (
    <div className="homeLoading" role="status" aria-live="polite">
      <div className="homeLoading__logo">LE</div>
      <div className="homeLoading__cables" aria-hidden="true">
        <div className="cable cable--left" />
        <div className="spark" />
        <div className="cable cable--right" />
      </div>
      <p className="homeLoading__text">Conectando iniciativas…</p>

      {/* CSS da animação (JSX usa template string) */}
      <style>{`
        .homeLoading {
          position: fixed; inset: 0; display: grid; place-items: center;
          background: var(--bg); z-index: 9999; gap: 16px; text-align: center;
          color: var(--text);
        }
        .homeLoading__logo {
          width: 84px; height: 84px; border-radius: 50%;
          background: var(--card-bg);
          display: grid; place-items: center; font-weight: 900;
          color: var(--primary); box-shadow: var(--shadow); font-size: 28px;
          letter-spacing: .5px;
          animation: pop 650ms ease-out both;
        }
        .homeLoading__text { color: var(--muted); font-weight: 600; }

        .homeLoading__cables { position: relative; width: 200px; height: 40px; }
        .cable { position: absolute; top: 50%; width: 48%; height: 6px;
          background: #222; transform: translateY(-50%);
          border-radius: 3px; animation: pulse 1.2s infinite ease-in-out;
        }
        .cable--left { left: 0; transform: translateY(-50%) rotate(2deg); }
        .cable--right { right: 0; transform: translateY(-50%) rotate(-2deg); }
        .spark {
          position: absolute; top: 50%; left: calc(50% - 6px);
          width: 12px; height: 12px; border-radius: 50%;
          background: radial-gradient(circle, #ffd54f 0%, #ff9100 60%, rgba(255,145,0,0) 70%);
          transform: translateY(-50%); animation: spark 1.2s infinite ease-in-out;
        }
        @keyframes pulse { 0%,100%{background:#222} 50%{background: var(--primary)} }
        @keyframes spark { 0%,100%{opacity:.15; transform: translateY(-50%) scale(.8)}
                           50%{opacity:.9; transform: translateY(-50%) scale(1.2)} }
        @keyframes pop { 0%{transform:scale(.8); opacity:0} 100%{transform:scale(1); opacity:1} }
      `}</style>
    </div>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Lideranças Empáticas • Início';
  }, []);

  // Pré-carrega imagens dos cards para evitar "piscadas"
  const imgs = useMemo(() => [img1, img2, img3, img4], []);
  const loadedMap = usePreloadImages(imgs);
  const allLoaded = imgs.every((u) => loadedMap[u]);

  useEffect(() => {
    // Simula boot inicial + aguarda imagens
    if (allLoaded) {
      const t = setTimeout(() => setLoading(false), 250);
      return () => clearTimeout(t);
    }
  }, [allLoaded]);

  return (
    <div className="page">
      {loading && <LoadingOverlay />}

      <Header />

      <main className="container">
        {/* usa .container do styles.css */}
        <SectionHero />

        {/* Métricas — você pode trocar pelos valores da API quando quiser */}
        <MetricCard
          layout="leftText"
          bg="var(--green-700)"
          image={loadedMap[img1] ? img1 : undefined}
          value={87763}
          unit="Kg"
          subtitle="Em arrecadações"
          kicker="Mais de"
          imageAlt="Equipe com doações em um evento comunitário"
        />
        <MetricCard
          layout="rightText"
          bg="var(--green-800)"
          image={loadedMap[img2] ? img2 : undefined}
          value={7800}
          subtitle="Pessoas alimentadas durante 1 mês"
          imageAlt="Voluntários com cestas básicas e alimentos"
        />
        <MetricCard
          layout="leftText"
          bg="var(--green-700)"
          image={loadedMap[img3] ? img3 : undefined}
          value={1950}
          subtitle="Famílias alimentadas durante 1 mês"
          imageAlt="Ação de distribuição de alimentos"
        />
        <MetricCard
          layout="rightText"
          bg="var(--green-800)"
          image={loadedMap[img4] ? img4 : undefined}
          value={1600}
          subtitle="Alunos participantes"
          kicker="Mais de"
          imageAlt="Grupo de estudantes participantes do projeto"
        />
      </main>
    </div>
  );
}