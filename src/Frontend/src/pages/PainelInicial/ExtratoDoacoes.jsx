// src/pages/PainelInicial/ExtratoDoacoes.jsx
// Este é o NOVO componente que mostra o "Extrato" de doações.

import React, { useMemo, useState } from "react";
import "./PainelInicial.css"; // Reutiliza os estilos

// Helper para carregar dados do localStorage
const load = (key, fallback) => {
  try { //
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

// Formata data e valores
const formatDt = (ts) => new Date(ts || 0).toLocaleString("pt-BR", {
  day: '2-digit', month: '2-digit', year: 'numeric'
});
const formatVal = (doacao) => {
  if (doacao.tipo === 'dinheiro') {
    return `R$ ${(Number(doacao.valor) || 0).toFixed(2)}`;
  }
  if (doacao.tipo === 'itens') { //
    return `${doacao.peso || 0} ${doacao.unidadePeso || 'kg'} (Qtd: ${doacao.quantidade || 0})`;
  }
  return "N/A";
};

export default function ExtratoDoacoes() {
  // Estado do filtro: 'todos' | 'dinheiro' | 'itens'
  const [filtroTipo, setFiltroTipo] = useState("todos");

  // Carrega os dados brutos das atividades e grupos
  const [atividadesMap] = useState(() => load("atividades_by_group", {})); //
  const [grupos] = useState(() => load("grupos", [])); //

  // Cria um "map" de ID para Nome do grupo, para performance
  const grupoMap = useMemo(() => {
    return new Map(grupos.map(g => [g.id, g.nome]));
  }, [grupos]);

  // Processa e filtra as doações
  const doacoesFiltradas = useMemo(() => {
    const todasDoacoes = [];
    
    // Itera sobre o mapa de atividades { [groupId]: [ativ1, ativ2] }
    for (const [groupId, atividades] of Object.entries(atividadesMap)) {
      if (!atividades) continue;

      for (const ativ of atividades) {
        // Pega apenas atividades que tenham uma doação registrada
        if (ativ.doacao) { //
          
          // Filtra pelo tipo selecionado
          if (filtroTipo === 'todos' || (filtroTipo === 'dinheiro' && ativ.doacao.tipo === 'dinheiro') || (filtroTipo === 'itens' && ativ.doacao.tipo === 'itens')) {
            todasDoacoes.push({
              ...ativ.doacao,
              id: ativ.id,
              atividadeTitulo: ativ.titulo,
              createdAt: ativ.createdAt,
              grupoName: grupoMap.get(Number(groupId)) || "Grupo desconhecido",
            });
          }
        }
      }
    }
    // Ordena por data
    return todasDoacoes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [atividadesMap, filtroTipo, grupoMap]);

  return (
    <section className="grupos-section" style={{ marginTop: '1.5rem' }}>
      <div className="grupos-header">
        <h2>Extrato de Doações (Todos os Grupos)</h2>
      </div>

      {/* Filtros do Extrato */}
      <div className="filters" style={{ marginBottom: '1rem' }}>
        <div className="seg-buttons" role="tablist">
          <button
            type="button"
            role="tab"
            className={`seg ${filtroTipo === "todos" ? "active" : ""}`} //
            onClick={() => setFiltroTipo("todos")}
          >
            Todos os Tipos
          </button>
          <button
            type="button"
            role="tab"
            className={`seg ${filtroTipo === "dinheiro" ? "active" : ""}`} //
            onClick={() => setFiltroTipo("dinheiro")}
          >
            Dinheiro
          </button>
          <button
            type="button"
            role="tab"
            className={`seg ${filtroTipo === "itens" ? "active" : ""}`} //
            onClick={() => setFiltroTipo("itens")} // O tipo 'itens' corresponde a alimentos
          >
            Alimentos/Itens
          </button>
        </div>
      </div>

      {/* Lista de Doações */}
      {doacoesFiltradas.length === 0 ? (
        <p>Nenhuma doação encontrada para este filtro.</p>
      ) : (
        <div className="event-list">
          {doacoesFiltradas.map((d) => (
            <div key={d.id} className="event-card"> {/* */}
              <div className="event-card__content">
                <h3>{formatVal(d)}</h3> {/* Valor ou KG */}
                <p className="muted">
                  Doador: <strong>{d.doador || "Anônimo"}</strong>
                </p>
                <p className="muted">
                  Registrado em: {formatDt(d.createdAt)} · Grupo: {d.grupoName}
                </p>
                <p>Referente à atividade: "{d.atividadeTitulo}"</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}