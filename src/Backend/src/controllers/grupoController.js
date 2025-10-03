import { pool } from "../db.js";

// GET todos os grupos
export async function getGrupos(_, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM grupo");
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar grupos" });
  }
}

// GET grupo por id
export async function getGrupoById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query("SELECT * FROM grupo WHERE ID_grupo = ?", [
      id,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ error: "Grupo não encontrado" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao buscar grupo" });
  }
}

// POST criar grupo
export async function createGrupo(req, res) {
  const { nome_grupo, mentor } = req.body;
  if (!nome_grupo || !mentor)
    return res
      .status(400)
      .json({ error: "Campos obrigatórios: nome_grupo e mentor" });
  try {
    const [ins] = await pool.query(
      "INSERT INTO grupo (nome_grupo, mentor) VALUES (?, ?)",
      [nome_grupo, mentor]
    );
    const [rows] = await pool.query("SELECT * FROM grupo WHERE ID_grupo = ?", [
      ins.insertId,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Grupo ou mentor já existe" });
    res.status(500).json({ error: "Erro ao criar grupo" });
  }
}

// PUT atualizar grupo
export async function updateGrupo(req, res) {
  const { id } = req.params;
  const { nome_grupo, mentor } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE grupo SET nome_grupo = ?, mentor = ? WHERE ID_grupo = ?",
      [nome_grupo, mentor, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Grupo não encontrado" });
    const [rows] = await pool.query("SELECT * FROM grupo WHERE ID_grupo = ?", [
      id,
    ]);
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao atualizar grupo" });
  }
}

// DELETE grupo
export async function deleteGrupo(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM grupo WHERE ID_grupo = ?", [
      id,
    ]);
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Grupo não encontrado" });
    res.json({ message: "Grupo excluído com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir grupo" });
  }
}
