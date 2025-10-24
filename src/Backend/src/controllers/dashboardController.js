// src/Backend/src/controllers/dashboardController.js
import { pool } from "../db.js";

/**
 * GET /api/dashboard/:grupoId/summary
 * => { meta: number, progresso: number, totalItens: number }
 */
export async function getDashboardSummary(req, res) {
  const { grupoId } = req.params;
  try {
    const [[g]] = await pool.query(
      `SELECT meta_arrecadacao AS meta FROM grupo WHERE ID_grupo=?`,
      [grupoId]
    );
    if (!g) return res.status(404).json({ error: "Grupo não encontrado" });

    const [[money]] = await pool.query(
      `
      SELECT COALESCE(SUM(dd.valor_doacao),0) AS progresso
        FROM doacao d
        JOIN doacao_dinheiro dd ON dd.ID_doacao = d.ID_doacao
        JOIN postagem p ON p.ID_postagem = d.ID_postagem
        JOIN usuario u ON u.ID_usuario = p.ID_usuario
       WHERE u.ID_grupo = ?
      `,
      [grupoId]
    );

    const [[items]] = await pool.query(
      `
      SELECT COALESCE(SUM(di.quantidade),0) AS totalItens
        FROM doacao d
        JOIN doacao_item di ON di.ID_doacao = d.ID_doacao
        JOIN postagem p ON p.ID_postagem = d.ID_postagem
        JOIN usuario u ON u.ID_usuario = p.ID_usuario
       WHERE u.ID_grupo = ?
      `,
      [grupoId]
    );

    res.json({
      meta: Number(g?.meta ?? 0),
      progresso: Number(money?.progresso ?? 0),
      totalItens: Number(items?.totalItens ?? 0),
    });
  } catch (e) {
    res.status(500).json({ error: "Erro ao carregar resumo" });
  }
}

/**
 * GET /api/dashboard/:grupoId/inventory
 * => [{ nome, unidade, quantidade }]
 */
export async function getDashboardInventory(req, res) {
  const { grupoId } = req.params;
  try {
    const [rows] = await pool.query(
      `
      SELECT di.item_doacao AS nome,
             di.unidade,
             COALESCE(SUM(di.quantidade),0) AS quantidade
        FROM doacao d
        JOIN doacao_item di ON di.ID_doacao = d.ID_doacao
        JOIN postagem p ON p.ID_postagem = d.ID_postagem
        JOIN usuario u ON u.ID_usuario = p.ID_usuario
       WHERE u.ID_grupo = ?
       GROUP BY di.item_doacao, di.unidade
       HAVING nome IS NOT NULL
       ORDER BY quantidade DESC, nome ASC
      `,
      [grupoId]
    );
    res.json(rows.map(r => ({
      nome: r.nome,
      unidade: r.unidade,
      quantidade: Number(r.quantidade ?? 0),
    })));
  } catch {
    res.status(500).json({ error: "Erro ao carregar inventário" });
  }
}

/**
 * GET /api/dashboard/:grupoId/timeseries?range=7d|30d|mes
 * => [{ data:'YYYY-MM-DD', valor:number }]
 */
export async function getDashboardTimeseries(req, res) {
  const { grupoId } = req.params;
  const { range = "30d" } = req.query;

  let dateFilter =
    "DATE(d.doacao_data_registro) >= (CURRENT_DATE - INTERVAL 30 DAY)";
  if (range === "7d") dateFilter =
    "DATE(d.doacao_data_registro) >= (CURRENT_DATE - INTERVAL 7 DAY)";
  if (range === "mes") dateFilter =
    "YEAR(d.doacao_data_registro) = YEAR(CURRENT_DATE) AND MONTH(d.doacao_data_registro) = MONTH(CURRENT_DATE)";

  try {
    const [rows] = await pool.query(
      `
      SELECT DATE(d.doacao_data_registro) AS data,
             COALESCE(SUM(dd.valor_doacao),0) AS valor
        FROM doacao d
        JOIN doacao_dinheiro dd ON dd.ID_doacao = d.ID_doacao
        JOIN postagem p ON p.ID_postagem = d.ID_postagem
        JOIN usuario u ON u.ID_usuario = p.ID_usuario
       WHERE u.ID_grupo = ? AND ${dateFilter}
       GROUP BY DATE(d.doacao_data_registro)
       ORDER BY DATE(d.doacao_data_registro) ASC
      `,
      [grupoId]
    );

    const out = rows.map(r => ({
      data: new Date(r.data).toISOString().slice(0, 10),
      valor: Number(r.valor ?? 0),
    }));
    res.json(out);
  } catch {
    res.status(500).json({ error: "Erro ao carregar série temporal" });
  }
}

/**
 * GET /api/dashboard/global/summary
 * => { metaTotal, progressoTotal, totalItens }
 * (útil para a página de login/overview com todos os grupos)
 */
export async function getGlobalSummary(_req, res) {
  try {
    const [[m]] = await pool.query(
      `SELECT COALESCE(SUM(meta_arrecadacao),0) AS metaTotal FROM grupo`
    );

    const [[money]] = await pool.query(
      `
      SELECT COALESCE(SUM(dd.valor_doacao),0) AS progressoTotal
        FROM doacao d
        JOIN doacao_dinheiro dd ON dd.ID_doacao = d.ID_doacao
      `
    );

    const [[items]] = await pool.query(
      `
      SELECT COALESCE(SUM(di.quantidade),0) AS totalItens
        FROM doacao d
        JOIN doacao_item di ON di.ID_doacao = d.ID_doacao
      `
    );

    res.json({
      metaTotal: Number(m?.metaTotal ?? 0),
      progressoTotal: Number(money?.progressoTotal ?? 0),
      totalItens: Number(items?.totalItens ?? 0),
    });
  } catch {
    res.status(500).json({ error: "Erro ao carregar resumo global" });
  }
}
