import { pool } from "../db.js";

// GET todos os usuários
export async function getUsuarios(_, res) {
  try {
    const [rows] = await pool.query(`
      SELECT u.ID_usuario, u.RA, u.nome_usuario, u.email, u.cargo, g.nome_grupo
      FROM usuario u
      LEFT JOIN grupo g ON u.ID_grupo = g.ID_grupo
      ORDER BY u.ID_usuario DESC
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
}

// GET usuário por id
export async function getUsuarioById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT u.ID_usuario, u.RA, u.nome_usuario, u.email, u.cargo, g.nome_grupo
       FROM usuario u
       LEFT JOIN grupo g ON u.ID_grupo = g.ID_grupo
       WHERE u.ID_usuario = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
}

// POST criar usuário
export async function createUsuario(req, res) {
  const { RA, nome_usuario, email, senha, cargo, ID_grupo } = req.body;
  if (!RA || !nome_usuario || !email || !senha || !cargo) {
    return res
      .status(400)
      .json({
        error: "Campos obrigatórios: RA, nome_usuario, email, senha, cargo",
      });
  }
  try {
    const [ins] = await pool.query(
      "INSERT INTO usuario (RA, nome_usuario, email, senha, cargo, ID_grupo) VALUES (?, ?, ?, ?, ?, ?)",
      [RA, nome_usuario, email, senha, cargo, ID_grupo || null]
    );
    const [rows] = await pool.query(
      "SELECT * FROM usuario WHERE ID_usuario = ?",
      [ins.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "RA ou email já cadastrados" });
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
}

// PUT atualizar usuário
export async function updateUsuario(req, res) {
  const { id } = req.params;
  const { RA, nome_usuario, email, senha, cargo, ID_grupo } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE usuario SET RA=?, nome_usuario=?, email=?, senha=?, cargo=?, ID_grupo=? WHERE ID_usuario=?",
      [RA, nome_usuario, email, senha, cargo, ID_grupo || null, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Usuário não encontrado" });
    const [rows] = await pool.query(
      "SELECT * FROM usuario WHERE ID_usuario = ?",
      [id]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "RA ou email já cadastrados" });
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
}

// DELETE usuário
export async function deleteUsuario(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      "DELETE FROM usuario WHERE ID_usuario = ?",
      [id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ message: "Usuário excluído com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir usuário" });
  }
}
