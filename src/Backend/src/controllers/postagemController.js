import { pool } from "../DataBase/db.js";

// GET todas postagens
export async function getPostagens(_, res) {
  try {
    const [rows] = await pool.query(`
      SELECT p.ID_postagem, p.conteudo, p.postagem_data_envio, p.tipo_postagem,
             u.nome_usuario, u.email
      FROM postagem p
      JOIN usuario u ON p.ID_usuario = u.ID_usuario
      ORDER BY p.ID_postagem DESC
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar postagens" });
  }
}

// GET postagem por id
export async function getPostagemById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT p.ID_postagem, p.conteudo, p.postagem_data_envio, p.tipo_postagem,
              u.nome_usuario, u.email
       FROM postagem p
       JOIN usuario u ON p.ID_usuario = u.ID_usuario
       WHERE p.ID_postagem = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Postagem não encontrada" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao buscar postagem" });
  }
}

// POST criar postagem
export async function createPostagem(req, res) {
  const { conteudo, tipo_postagem, ID_usuario } = req.body;
  if (!conteudo || !tipo_postagem || !ID_usuario) {
    return res
      .status(400)
      .json({
        error: "Campos obrigatórios: conteudo, tipo_postagem, ID_usuario",
      });
  }
  try {
    const [ins] = await pool.query(
      "INSERT INTO postagem (conteudo, tipo_postagem, ID_usuario) VALUES (?, ?, ?)",
      [conteudo, tipo_postagem, ID_usuario]
    );
    const [rows] = await pool.query(
      "SELECT * FROM postagem WHERE ID_postagem = ?",
      [ins.insertId]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao criar postagem" });
  }
}

// PUT atualizar postagem
export async function updatePostagem(req, res) {
  const { id } = req.params;
  const { conteudo, tipo_postagem, ID_usuario } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE postagem SET conteudo=?, tipo_postagem=?, ID_usuario=? WHERE ID_postagem=?",
      [conteudo, tipo_postagem, ID_usuario, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Postagem não encontrada" });
    const [rows] = await pool.query(
      "SELECT * FROM postagem WHERE ID_postagem = ?",
      [id]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao atualizar postagem" });
  }
}

// DELETE postagem
export async function deletePostagem(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      "DELETE FROM postagem WHERE ID_postagem = ?",
      [id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Postagem não encontrada" });
    res.json({ message: "Postagem excluída com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir postagem" });
  }
}
