import { pool } from "../DataBase/db.js";

// GET todos relatórios
export async function getRelatorios(_, res) {
  try {
    const [rows] = await pool.query(`
      SELECT r.ID_relatorio, r.periodo_inicio, r.periodo_fim, r.relatorio_data_criacao,
             g.nome_grupo
      FROM relatorio r
      JOIN grupo g ON r.ID_grupo = g.ID_grupo
      ORDER BY r.ID_relatorio DESC
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar relatórios" });
  }
}

// GET relatório por id
export async function getRelatorioById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT r.ID_relatorio, r.periodo_inicio, r.periodo_fim, r.relatorio_data_criacao,
              g.nome_grupo
       FROM relatorio r
       JOIN grupo g ON r.ID_grupo = g.ID_grupo
       WHERE r.ID_relatorio = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Relatório não encontrado" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao buscar relatório" });
  }
}

// POST criar relatório
export async function createRelatorio(req, res) {
  const { periodo_inicio, periodo_fim, ID_grupo } = req.body;
  if (!periodo_inicio || !periodo_fim || !ID_grupo) {
    return res
      .status(400)
      .json({
        error: "Campos obrigatórios: periodo_inicio, periodo_fim, ID_grupo",
      });
  }
  try {
    const [ins] = await pool.query(
      "INSERT INTO relatorio (periodo_inicio, periodo_fim, ID_grupo) VALUES (?, ?, ?)",
      [periodo_inicio, periodo_fim, ID_grupo]
    );
    const [rows] = await pool.query(
      "SELECT * FROM relatorio WHERE ID_relatorio = ?",
      [ins.insertId]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao criar relatório" });
  }
}

// PUT atualizar relatório
export async function updateRelatorio(req, res) {
  const { id } = req.params;
  const { periodo_inicio, periodo_fim, ID_grupo } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE relatorio SET periodo_inicio=?, periodo_fim=?, ID_grupo=? WHERE ID_relatorio=?",
      [periodo_inicio, periodo_fim, ID_grupo, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Relatório não encontrado" });
    const [rows] = await pool.query(
      "SELECT * FROM relatorio WHERE ID_relatorio = ?",
      [id]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao atualizar relatório" });
  }
}

// DELETE relatório
export async function deleteRelatorio(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      "DELETE FROM relatorio WHERE ID_relatorio = ?",
      [id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Relatório não encontrado" });
    res.json({ message: "Relatório excluído com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir relatório" });
  }
}
