// src/Backend/src/controllers/dashboardController.js
import { pool } from "../DataBase/db.js"; 

/**
 * GET /api/dashboard/:grupoId/summary
 * => { meta, progresso, totalItens }
 * ATUALIZADO para o novo schema: doacao ligado diretamente ao grupo.
 */
export async function getSummary(req, res) {
  const { grupoId } = req.params;
  try {
    // 1. Meta (da tabela grupo)
    const [[g]] = await pool.query(
      `SELECT meta_arrecadacao AS meta 
       FROM grupo 
       WHERE ID_grupo=?`, // ID_grupo
      [grupoId]
    );
    if (!g) return res.status(404).json({ error: "Grupo não encontrado" });

    // 2. Progresso em dinheiro (da tabela doacao, filtrando por tipo e status)
    const [[money]] = await pool.query(
      `SELECT COALESCE(SUM(valor_doacao), 0) AS progresso
         FROM doacao
        WHERE ID_grupo = ?                 -- <<<<<< Filtra pelo ID do grupo
          AND tipo_doacao = 'dinheiro'     -- <<<<<< Filtra por tipo 'dinheiro'
          AND status_doacao = 'aprovada'`, // <<<<<< Considera apenas doações aprovadas
      [grupoId]
    );

    // 3. Itens totais (da tabela doacao, filtrando por tipo e status)
    const [[items]] = await pool.query(
      `SELECT COALESCE(SUM(quantidade), 0) AS totalItens
         FROM doacao
        WHERE ID_grupo = ?              -- <<<<<< Filtra pelo ID do grupo
          AND tipo_doacao = 'item'      -- <<<<<< Filtra por tipo 'item'
          AND status_doacao = 'aprovada'`, // <<<<<< Considera apenas doações aprovadas
      [grupoId]
    );

    res.json({
      meta: Number(g.meta ?? 0),
      progresso: Number(money?.progresso ?? 0),
      totalItens: Number(items?.totalItens ?? 0),
    });
  } catch (e) {
    console.error("[dashboard.getSummary]", e);
    res.status(500).json({ error: "Erro ao carregar summary" });
  }
}

/**
 * GET /api/dashboard/:grupoId/inventory
 * => [ { nome, quantidade, unidade } ]
 * ATUALIZADO para o novo schema: doacao ligado diretamente ao grupo.
 */
export async function getInventory(req, res) {
  const { grupoId } = req.params;
  try {
    // Busca itens da tabela doacao, filtrando por tipo e status
    const [rows] = await pool.query(
      `SELECT 
           item_doacao AS nome,         --
           unidade,                     --
           COALESCE(SUM(quantidade), 0) AS quantidade --
         FROM doacao
        WHERE ID_grupo = ?              -- <<<<<< Filtra pelo ID do grupo
          AND tipo_doacao = 'item'      -- <<<<<< Filtra por tipo 'item'
          AND status_doacao = 'aprovada' -- <<<<<< Considera apenas doações aprovadas
        GROUP BY item_doacao, unidade   -- Agrupa por nome E unidade
        ORDER BY nome ASC, unidade ASC`,
      [grupoId]
    );
    // Formata a saída para incluir a unidade, como esperado pelo frontend
    const mappedRows = rows.map(r => ({
        nome: r.nome,
        quantidade: Number(r.quantidade ?? 0),
        unidade: r.unidade // Adiciona a unidade
    }));
    res.json(mappedRows);
  } catch (e) {
    console.error("[dashboard.getInventory]", e);
    res.status(500).json({ error: "Erro ao carregar inventário" });
  }
}

/**
 * GET /api/dashboard/:grupoId/timeseries?range=7d|30d|mes
 * => [ { data: 'YYYY-MM-DD', valor } ]
 * ATUALIZADO para o novo schema: doacao ligado diretamente ao grupo.
 */
export async function getTimeseries(req, res) {
  const { grupoId } = req.params;
  const { range = "30d" } = req.query; //

  // Define o filtro de data baseado no 'range'
  let whereDate = "DATE(doacao_data_registro) >= (CURRENT_DATE - INTERVAL 30 DAY)"; //
  if (range === "7d")  whereDate = "DATE(doacao_data_registro) >= (CURRENT_DATE - INTERVAL 7 DAY)"; //
  if (range === "mes") whereDate = "YEAR(doacao_data_registro)=YEAR(CURRENT_DATE) AND MONTH(doacao_data_registro)=MONTH(CURRENT_DATE)"; //

  try {
    // Busca valores da tabela doacao, filtrando por data, tipo e status
    const [rows] = await pool.query(
      `SELECT 
           DATE(doacao_data_registro) AS data,      --
           COALESCE(SUM(valor_doacao), 0) AS valor  --
         FROM doacao
        WHERE ID_grupo = ?              -- <<<<<< Filtra pelo ID do grupo
          AND tipo_doacao = 'dinheiro'  -- <<<<<< Filtra por tipo 'dinheiro'
          AND status_doacao = 'aprovada' -- <<<<<< Considera apenas doações aprovadas
          AND ${whereDate}              -- <<<<<< Aplica o filtro de data
        GROUP BY DATE(doacao_data_registro)
        ORDER BY DATE(doacao_data_registro) ASC`,
      [grupoId]
    );
    // Formata a data para YYYY-MM-DD
    const out = rows.map(r => ({
      // Garante que a data esteja no formato correto e UTC para evitar problemas de fuso
      data: new Date(r.data.getTime() - r.data.getTimezoneOffset() * -60000).toISOString().slice(0, 10),
      valor: Number(r.valor ?? 0),
    }));
    res.json(out);
  } catch (e) {
    console.error("[dashboard.getTimeseries]", e);
    res.status(500).json({ error: "Erro ao carregar série temporal" });
  }
}