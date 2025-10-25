// src/Backend/src/controllers/dashboardController.js
import { pool } from "../DataBase/db.js"; 

/**
 * GET /api/dashboard/:grupoId/summary
 * => { meta, progresso, totalItens }
 * Compatível com schema: doacao + doacao_dinheiro + doacao_item,
 * ligados por postagem -> usuario -> grupo.
 */
export async function getSummary(req, res) {
  const { grupoId } = req.params;
  try {
    // Meta (grupo)
    const [[g]] = await pool.query(
      `SELECT meta_arrecadacao AS meta FROM grupo WHERE ID_grupo=?`,
      [grupoId]
    );
    if (!g) return res.status(404).json({ error: "Grupo não encontrado" });

    // Progresso em dinheiro
    const [[money]] = await pool.query(
      `SELECT COALESCE(SUM(dd.valor_doacao),0) AS progresso
         FROM usuario u
         JOIN postagem p ON p.ID_usuario = u.ID_usuario
         JOIN doacao d   ON d.ID_postagem = p.ID_postagem
         JOIN doacao_dinheiro dd ON dd.ID_doacao = d.ID_doacao
        WHERE u.ID_grupo = ?`,
      [grupoId]
    );

    // Itens totais
    const [[items]] = await pool.query(
      `SELECT COALESCE(SUM(di.quantidade),0) AS totalItens
         FROM usuario u
         JOIN postagem p ON p.ID_usuario = u.ID_usuario
         JOIN doacao d   ON d.ID_postagem = p.ID_postagem
         JOIN doacao_item di ON di.ID_doacao = d.ID_doacao
        WHERE u.ID_grupo = ?`,
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
 * => [ { nome, quantidade } ]
 */
export async function getInventory(req, res) {
  const { grupoId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT di.item_doacao AS nome, COALESCE(SUM(di.quantidade),0) AS quantidade
         FROM usuario u
         JOIN postagem p ON p.ID_usuario = u.ID_usuario
         JOIN doacao d   ON d.ID_postagem = p.ID_postagem
         JOIN doacao_item di ON di.ID_doacao = d.ID_doacao
        WHERE u.ID_grupo = ?
        GROUP BY di.item_doacao
        ORDER BY quantidade DESC, nome ASC`,
      [grupoId]
    );
    res.json(rows);
  } catch (e) {
    console.error("[dashboard.getInventory]", e);
    res.status(500).json({ error: "Erro ao carregar inventário" });
  }
}

/**
 * GET /api/dashboard/:grupoId/timeseries?range=7d|30d|mes
 * => [ { data: 'YYYY-MM-DD', valor } ]
 */
export async function getTimeseries(req, res) {
  const { grupoId } = req.params;
  const { range = "30d" } = req.query;

  let whereDate = "DATE(d.doacao_data_registro) >= (CURRENT_DATE - INTERVAL 30 DAY)";
  if (range === "7d")  whereDate = "DATE(d.doacao_data_registro) >= (CURRENT_DATE - INTERVAL 7 DAY)";
  if (range === "mes") whereDate = "YEAR(d.doacao_data_registro)=YEAR(CURRENT_DATE) AND MONTH(d.doacao_data_registro)=MONTH(CURRENT_DATE)";

  try {
    const [rows] = await pool.query(
      `SELECT DATE(d.doacao_data_registro) AS data, COALESCE(SUM(dd.valor_doacao),0) AS valor
         FROM usuario u
         JOIN postagem p ON p.ID_usuario = u.ID_usuario
         JOIN doacao d   ON d.ID_postagem = p.ID_postagem
         JOIN doacao_dinheiro dd ON dd.ID_doacao = d.ID_doacao
        WHERE u.ID_grupo = ? AND ${whereDate}
        GROUP BY DATE(d.doacao_data_registro)
        ORDER BY DATE(d.doacao_data_registro) ASC`,
      [grupoId]
    );
    const out = rows.map(r => ({
      data: new Date(r.data).toISOString().slice(0, 10),
      valor: Number(r.valor ?? 0),
    }));
    res.json(out);
  } catch (e) {
    console.error("[dashboard.getTimeseries]", e);
    res.status(500).json({ error: "Erro ao carregar série temporal" });
  }
}