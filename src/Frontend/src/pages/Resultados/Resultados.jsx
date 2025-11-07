// src/pages/Resultados.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/Header.jsx';

/**
 * Mock inicial (exemplo): quando sua API estiver pronta,
 * troque por fetch('/api/edicoes') e mantenha o mesmo formato.
 *
 * Observação: O site de referência lista edições por ano/semestre e exibe Kg e R$,
 * além de permitir baixar relatórios; vamos seguir esse padrão.  [1](https://liderancasempaticas.com/resultados-do-projeto)
 */
const EDIÇÕES_MOCK = [
  // Exemplo com dados reais você preenche depois; aqui já deixo alguns placeholders
  { id: '2025-1', ano: 2025, semestre: 1, kg: null, brl: null, relatorioUrl: null, dashboardUrl: null, status: 'em-breve' },
  { id: '2024-2', ano: 2024, semestre: 2, kg: 16470, brl: 102961, relatorioUrl: null, dashboardUrl: null, status: 'publicado' },
  { id: '2024-1', ano: 2024, semestre: 1, kg: 9736, brl: 61451, relatorioUrl: null, dashboardUrl: null, status: 'publicado' },
  { id: '2023-2', ano: 2023, semestre: 2, kg: 7112, brl: 58466, relatorioUrl: null, dashboardUrl: null, status: 'publicado' },
  { id: '2023-1', ano: 2023, semestre: 1, kg: 19270, brl: 145819, relatorioUrl: null, dashboardUrl: null, status: 'publicado' },
  { id: '2022-2', ano: 2022, semestre: 2, kg: 2208, brl: 16275, relatorioUrl: null, dashboardUrl: null, status: 'publicado' },
  { id: '2022-1', ano: 2022, semestre: 1, kg: 4998, brl: 33990, relatorioUrl: null, dashboardUrl: null, status: 'publicado' },
];

/* Utilitário: formata número pt-BR */
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR') : '—');

/* Componente de Filtro */
function ResultadosFilter({ value, onChange, anos }) {
  return (
    <div className="resultados__filter">
      <div className="resultados__row">
        <label>
          <span>Ano</span>
          <select
            value={value.ano ?? ''}
            onChange={(e) => onChange({ ...value, ano: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Todos</option>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>

        <label>
          <span>Semestre</span>
          <select
            value={value.semestre ?? ''}
            onChange={(e) => onChange({ ...value, semestre: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Ambos</option>
            <option value="1">1º</option>
            <option value="2">2º</option>
          </select>
        </label>

        <button className="btn-pill" onClick={() => onChange({ ano: null, semestre: null })}>
          Limpar
        </button>
      </div>
    </div>
  );
}

/* Card de Edição */
function EdicaoCard({ ed }) {
  const hasData = typeof ed.kg === 'number' || typeof ed.brl === 'number';
  const disabled = !ed.relatorioUrl && !ed.dashboardUrl;

  return (
    <article className="edicao">
      <header className="edicao__head">
        <h3 className="edicao__title">
          {ed.ano}-{ed.semestre}
        </h3>
        <span className={`badge ${ed.status === 'em-breve' ? 'badge--muted' : 'badge--ok'}`}>
          {ed.status === 'em-breve' ? 'Em breve' : 'Publicado'}
        </span>
      </header>

      <div className="edicao__grid">
        <div className="edicao__kpi">
          <div className="kpi__label">Arrecadação</div>
          <div className="kpi__value">{fmt(ed.kg)} <span className="kpi__unit">Kg</span></div>
        </div>
        <div className="edicao__kpi">
          <div className="kpi__label">Equivalente</div>
          <div className="kpi__value">R$ {fmt(ed.brl)}</div>
        </div>
      </div>

      <div className="edicao__actions">
        <a
          className={`btn-pill ${!ed.relatorioUrl ? 'btn--ghost' : ''}`}
          href={ed.relatorioUrl || '#'}
          target={ed.relatorioUrl ? '_blank' : undefined}
          rel={ed.relatorioUrl ? 'noopener noreferrer' : undefined}
          aria-disabled={!ed.relatorioUrl}
          onClick={(e) => !ed.relatorioUrl && e.preventDefault()}
        >
          {ed.relatorioUrl ? 'Baixar Relatório (PDF)' : 'Relatório indisponível'}
        </a>

        <a
          className={`btn-pill ${!ed.dashboardUrl ? 'btn--ghost' : ''}`}
          href={ed.dashboardUrl || '#'}
          target={ed.dashboardUrl ? '_blank' : undefined}
          rel={ed.dashboardUrl ? 'noopener noreferrer' : undefined}
          aria-disabled={!ed.dashboardUrl}
          onClick={(e) => !ed.dashboardUrl && e.preventDefault()}
        >
          {ed.dashboardUrl ? 'Ver Dashboard' : 'Dashboard indisponível'}
        </a>
      </div>
    </article>
  );
}

export default function Resultados() {
  const [filtro, setFiltro] = useState({ ano: null, semestre: null });

  useEffect(() => {
    document.title = 'Lideranças Empáticas • Resultados';
  }, []);

  // Anos disponíveis
  const anos = useMemo(() => {
    const set = new Set(EDIÇÕES_MOCK.map((e) => e.ano));
    return Array.from(set).sort((a, b) => b - a);
  }, []);

  // Aplica filtros
  const edicoes = useMemo(() => {
    return EDIÇÕES_MOCK
      .filter((e) => (filtro.ano ? e.ano === filtro.ano : true))
      .filter((e) => (filtro.semestre ? e.semestre === filtro.semestre : true))
      .sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano;
        return b.semestre - a.semestre;
      });
  }, [filtro]);

  return (
    <div className="page">
      <Header />

      <main className="container">
        {/* Hero/Resumo inspirado no padrão do site referência (Resultados dedicados) */}
        <section className="resultados__hero">
          <h2>Resultados das Edições</h2>
          <p>
            Explore os resultados de cada edição do projeto. Quando os relatórios estiverem
            disponíveis, você poderá baixá-los e navegar pelos dados no dashboard interativo.
          </p>
          {/* O site referência apresenta “Resultados do Projeto” com agregados e links por edição.  [1](https://liderancasempaticas.com/resultados-do-projeto) */}
        </section>

        {/* Filtros */}
        <ResultadosFilter value={filtro} onChange={setFiltro} anos={anos} />

        {/* Lista de Edições */}
        <section className="resultados__list">
          {edicoes.map((ed) => (
            <EdicaoCard key={ed.id} ed={ed} />
          ))}
          {edicoes.length === 0 && (
            <div className="resultados__empty">
              Nenhuma edição encontrada com os filtros atuais.
            </div>
          )}
        </section>
      </main>

      {/* CSS específico encapsulado (usa theme.css + styles.css para base) */}
      <style>{`
        .resultados__hero {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 18px 18px 14px;
          box-shadow: var(--shadow);
          margin: 16px 0 12px;
        }
        .resultados__hero h2 { margin: 0 0 6px 0; }
        .resultados__hero p  { margin: 0; color: var(--muted); }

        .resultados__filter { margin: 12px 0 8px; }
        .resultados__row {
          display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 12px; padding: 10px;
        }
        .resultados__row label { display: grid; gap: 4px; color: var(--muted); font-size: .95rem; }
        .resultados__row select {
          padding: 8px 10px; border-radius: 8px; background: var(--bg);
          color: var(--text); border: 1px solid var(--border);
        }
        .btn--ghost { background: transparent !important; color: var(--muted) !important; border: 1px solid var(--border) !important; }

        .resultados__list { display: grid; gap: 12px; margin: 10px 0 24px; }
        .edicao {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
        }
        .edicao__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .edicao__title { margin: 0; font-size: 1.25rem; }
        .badge {
          display: inline-block; padding: 4px 8px; font-weight: 700;
          border-radius: 999px; font-size: .82rem; border: 1px solid var(--border);
          color: var(--muted);
        }
        .badge--ok { color: #0b7c50; border-color: #0b7c50; background: #cfffe5; }
        .badge--muted { color: var(--muted); }

        .edicao__grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px; margin: 10px 0 8px;
        }
        .edicao__kpi {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 10px;
        }
        .kpi__label { color: var(--muted); font-size: .9rem; margin-bottom: 4px; }
        .kpi__value { font-weight: 800; font-size: 1.25rem; }

        .edicao__actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .edicao__actions .btn-pill { text-decoration: none; }
        .resultados__empty {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 14px; color: var(--muted);
        }

        @media (max-width: 720px) {
          .edicao__grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}