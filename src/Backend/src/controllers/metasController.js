import { pool } from "../db.js";

// GET todas as metas
export async function getMetas(_, res) {
  try {
    const [rows] = await pool.query(`
      SELECT m.ID_metas, m.descricao, m.valor_esperado, m.meta_data_criacao, 
             m.meta_data_final, m.status, g.nome_grupo
      FROM metas m
      JOIN grupo g ON m.ID_grupo = g.ID_grupo
      ORDER BY m.ID_metas DESC
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar metas" });
  }
}

// GET meta por id
export async function getMetaById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT m.ID_metas, m.descricao, m.valor_esperado, m.meta_data_criacao, 
              m.meta_data_final, m.status, g.nome_grupo
       FROM metas m
       JOIN grupo g ON m.ID_grupo = g.ID_grupo
       WHERE m.ID_metas = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Meta não encontrada" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao buscar meta" });
  }
}

// POST criar meta
export async function createMeta(req, res) {
  const { descricao, valor_esperado, meta_data_final, status, ID_grupo } =
    req.body;
  if (
    !descricao ||
    !valor_esperado ||
    !meta_data_final ||
    !status ||
    !ID_grupo
  ) {
    return res
      .status(400)
      .json({
        error:
          "Campos obrigatórios: descricao, valor_esperado, meta_data_final, status, ID_grupo",
      });
  }
  try {
    const [ins] = await pool.query(
      "INSERT INTO metas (descricao, valor_esperado, meta_data_final, status, ID_grupo) VALUES (?, ?, ?, ?, ?)",
      [descricao, valor_esperado, meta_data_final, status, ID_grupo]
    );
    const [rows] = await pool.query("SELECT * FROM metas WHERE ID_metas = ?", [
      ins.insertId,
    ]);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao criar meta" });
  }
}

// PUT atualizar meta
export async function updateMeta(req, res) {
  const { id } = req.params;
  const { descricao, valor_esperado, meta_data_final, status, ID_grupo } =
    req.body;
  try {
    const [result] = await pool.query(
      "UPDATE metas SET descricao=?, valor_esperado=?, meta_data_final=?, status=?, ID_grupo=? WHERE ID_metas=?",
      [descricao, valor_esperado, meta_data_final, status, ID_grupo, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Meta não encontrada" });
    const [rows] = await pool.query("SELECT * FROM metas WHERE ID_metas = ?", [
      id,
    ]);
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao atualizar meta" });
  }
}

// DELETE meta
export async function deleteMeta(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM metas WHERE ID_metas = ?", [
      id,
    ]);
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Meta não encontrada" });
    res.json({ message: "Meta excluída com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir meta" });
  }
}
