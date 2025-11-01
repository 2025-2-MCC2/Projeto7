// src/pages/PainelInicial/ExtratoDoacoes.jsx
// Com fix das keys únicas por item (uid) e melhorias de robustez
import React, { useMemo, useState } from "react";
import "./PainelInicial.css";

// Helpers
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

const formatDt = (ts) =>
  new Date(ts || 0).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatVal = (doacao) => {
  if (doacao.tipo === "dinheiro") {
    return `R$ ${(Number(doacao.valor) || 0).toFixed(2)}`;
  }
  if (doacao.tipo === "itens") {
    return `${doacao.peso || 0} ${doacao.unidadePeso || "kg"} (Qtd: ${doacao.quantidade || 0})`;
  }
  return "N/A";
};

export default function ExtratoDoacoes() {
  const [filtroTipo, setFiltroTipo] = useState("todos"); // 'todos' | 'dinheiro' | 'itens'

  // Dados base
  const [atividadesMap] = useState(() => load("atividades_by_group", {}));
  const [grupos] = useState(() => load("grupos", []));

  // Mapa id->nome do grupo
  const grupoMap = useMemo(
    () => new Map(grupos.map((g) => [g.id, g.nome])),
    [grupos]
  );

  // Consolida doações de todos os grupos e aplica filtro
  const doacoesFiltradas = useMemo(() => {
    const todasDoacoes = [];

    for (const [groupIdStr, atividades] of Object.entries(atividadesMap)) {
      const groupId = Number(groupIdStr);
      if (!atividades) continue;

      for (const ativ of atividades) {
        // só se a atividade tiver doação registrada
        if (!ativ.doacao) continue;

        const tipo = ativ.doacao.tipo;
        const passaFiltro =
          filtroTipo === "todos" ||
          (filtroTipo === "dinheiro" && tipo === "dinheiro") ||
          (filtroTipo === "itens" && tipo === "itens");

        if (!passaFiltro) continue;

        // Gera uma chave única e estável por item (grupo + atividade + tipo)
        const uid = `${groupId}:${ativ.id}:${tipo || "na"}`;

        todasDoacoes.push({
          ...ativ.doacao,
          id: ativ.id, // mantém se precisar exibir
          uid, // <- chave única para React
          groupId, // <- útil para futuras operações
          atividadeTitulo: ativ.titulo,
          createdAt: ativ.createdAt,
          grupoName: grupoMap.get(groupId) || "Grupo desconhecido",
        });
      }
    }

    // Ordena por data desc
    return todasDoacoes.sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
  }, [atividadesMap, filtroTipo, grupoMap]);

  return (
    <section className="grupos-section" style={{ marginTop: "1.5rem" }}>
      <div className="grupos-header">
        <h2>Extrato de Doações (Todos os Grupos)</h2>
      </div>

      {/* Filtros */}
      <div className="filters" style={{ marginBottom: "1rem" }}>
        <div className="seg-buttons" role="tablist">
          <button
            type="button"
            role="tab"
            className={`seg ${filtroTipo === "todos" ? "active" : ""}`}
            onClick={() => setFiltroTipo("todos")}
          >
            Todos os Tipos
          </button>

          <button
            type="button"
            role="tab"
            className={`seg ${filtroTipo === "dinheiro" ? "active" : ""}`}
            onClick={() => setFiltroTipo("dinheiro")}
          >
            Dinheiro
          </button>

          <button
            type="button"
            role="tab"
            className={`seg ${filtroTipo === "itens" ? "active" : ""}`}
            onClick={() => setFiltroTipo("itens")}
          >
            Alimentos/Itens
          </button>
        </div>
      </div>

      {/* Lista */}
      {doacoesFiltradas.length === 0 ? (
        <p>Nenhuma doação encontrada para este filtro.</p>
      ) : (
        <div className="event-list">
          {doacoesFiltradas.map((d) => (
            <div key={d.uid} className="event-card">
              <div className="event-card__content">
                <h3>{formatVal(d)}</h3>
                <p className="muted">
                  Doador: <strong>{d.doador || "Anônimo"}</strong>
                </p>
                <p className="muted">
                  Registrado em: {formatDt(d.createdAt)} · Grupo: {d.grupoName}
                </p>
                <p>Referente à atividade: “{d.atividadeTitulo}”</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}