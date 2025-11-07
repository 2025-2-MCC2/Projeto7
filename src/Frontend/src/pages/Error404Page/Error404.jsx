// src/pages/Error404/Error404.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './Error404.css';

// use sua imagem local; se quiser, receba via prop: /...
import defaultImage from '../../assets/Error404.gif';

export default function Error404({ imageSrc, showHomeButton = true }) {
  const img = imageSrc || defaultImage;

  return (
    <main className="e404-wrap" role="main" aria-labelledby="e404-title">
      <section className="e404-card" aria-label="Página não encontrada">
        <div className="e404-hero">
          <h1 id="e404-title" className="e404-title" aria-label="Erro 404 em destaque">
            <span className="e404-kicker">ERROR</span> 404
          </h1>

          <figure className="e404-figure">
            <img
              className="e404-img"
              src={img}
              alt="Página não encontrada"
              decoding="async"
              loading="eager"
            />
          </figure>

          <p className="e404-sub">Parece que você se perdeu</p>
          <p className="e404-sub2">A página que você procura não está disponível.</p>

          {showHomeButton && (
            <Link to="/" className="e404-btn">Voltar para a Home</Link>
          )}
        </div>
      </section>
    </main>
  );
}