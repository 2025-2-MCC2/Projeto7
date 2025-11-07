  // src/pages/PainelInicial/ExtratoDoacoes.jsx
  import React, { useEffect, useMemo, useState } from "react";
  import "./PainelInicial.css";
  import {
    fetchGrupos,
    fetchDoacoesByGrupo,
    toExtratoItem,
    currencyBRL,
    dateBR,
  } from "../../services/doacoesService";

  export default function ExtratoDoacoes() {
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("todos"); // todos|dinheiro|item
    const [filtroStatus, setFiltroStatus] = useState("todas"); // todas|aprovada|pendente|rejeitada
    const [itens, setItens] = useState([]); // extrato consolidado

    useEffect(() => {
      let abort = false;
      (async () => {
        setLoading(true);
        setErro("");
        try {
          // 1) Carrega grupos
          const grupos = await fetchGrupos();
          // 2) Busca doações de cada grupo (mesmo endpoint do DoacaoGrupo)
          const listas = await Promise.all(
            grupos.map(async (g) => {
              const ds = await fetchDoacoesByGrupo(g.id, { status: "todas" });
              return ds.map((d) => toExtratoItem(d, g));
            })
          );
          if (!abort) setItens(listas.flat().sort((a, b) => {
            const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return db - da; // mais recentes primeiro
          }));
        } catch (e) {
          if (!abort) setErro(e?.message || "Erro ao carregar extrato.");
        } finally {
          if (!abort) setLoading(false);
        }
      })();
      return () => { abort = true; };
    }, []);

    const filtrados = useMemo(() => {
      let list = [...itens];
      if (filtroTipo !== "todos") list = list.filter(x => x.tipo === filtroTipo);
      if (filtroStatus !== "todas") list = list.filter(x => x.status === filtroStatus);
      return list;
    }, [itens, filtroTipo, filtroStatus]);

    const totais = useMemo(() => {
      const dinheiro = filtrados
        .filter(d => d.tipo === "dinheiro" && d.status !== "rejeitada")
        .reduce((acc, d) => acc + Number(d.valor || 0), 0);
      const itensQtd = filtrados
        .filter(d => d.tipo === "item" && d.status !== "rejeitada")
        .reduce((acc, d) => acc + Number(d.quantidade || 0), 0);
      return { dinheiro, itensQtd };
    }, [filtrados]);

    return (
      <section className="grupos-section" style={{ marginTop: "1.5rem" }}>
        <div className="grupos-header">
          <h2>Extrato de Doações</h2>
          <p className="muted">
            Registros consolidados de todos os grupos
          </p>
        </div>

        {/* Filtros */}
        <div className="filters" style={{ marginBottom: "1rem" }}>
          <div className="seg-buttons" role="tablist">
            {["todos", "dinheiro", "item"].map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={filtroTipo === t}
                className={`seg ${filtroTipo === t ? "active" : ""}`}
                onClick={() => setFiltroTipo(t)}
              >
                {t === "todos" ? "Todos os tipos" : t === "dinheiro" ? "Dinheiro" : "Itens"}
              </button>
            ))}
          </div>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            aria-label="Filtrar por status"
          >
            <option value="todas">Todos os status</option>
            <option value="aprovada">Aprovadas</option>
            <option value="pendente">Pendentes</option>
            <option value="rejeitada">Rejeitadas</option>
          </select>
        </div>

        {/* Totais */}
        <div className="totais" style={{ marginBottom: "1rem" }}>
          <strong>Total em dinheiro:</strong> {currencyBRL(totais.dinheiro)}{" "}
          <strong style={{ marginLeft: 10 }}>Total de itens:</strong> {totais.itensQtd}
        </div>

        {/* Lista */}
        {loading && <p>Carregando...</p>}
        {erro && <p className="message error" role="alert">{erro}</p>}
        {!loading && !erro && filtrados.length === 0 ? (
          <p>Nenhuma doação encontrada para este filtro.</p>
        ) : (
          <div className="event-list">
            {filtrados.map((d) => (
              <div key={d.id} className="event-card extrato-card">
                <div className="event-card__content">
                  <h3>
                    {d.tipo === "dinheiro"
                      ? `💰 ${currencyBRL(d.valor)}`
                      : `📦 ${d.item} (${d.quantidade} ${d.unidade || "un"})`}
                  </h3>
                  <p className="muted">
                    Doador: <strong>{d.doador}</strong>
                    {" · "}Status: <span className={`status-chip ${d.status}`}>{d.status}</span>
                  </p>
                  <p className="muted">
                    {dateBR(d.createdAt)} · Grupo: {d.grupoName}
                    {d.usuarioRegistro ? ` · por ${d.usuarioRegistro}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

