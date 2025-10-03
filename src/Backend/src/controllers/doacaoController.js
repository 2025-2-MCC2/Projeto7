import { pool } from "../db.js";

// GET todas as doações
export async function getDoacoes(_, res) {
  try {
    const [rows] = await pool.query(`
      SELECT d.ID_doacao, d.descricao, d.doacao_data_registro,
             p.conteudo AS postagem_conteudo, u.nome_usuario AS autor_postagem
      FROM doacao d
      JOIN postagem p ON d.ID_postagem = p.ID_postagem
      JOIN usuario u ON p.ID_usuario = u.ID_usuario
      ORDER BY d.ID_doacao DESC
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar doações" });
  }
}

// GET doação por id
export async function getDoacaoById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT d.ID_doacao, d.descricao, d.doacao_data_registro,
              p.conteudo AS postagem_conteudo, u.nome_usuario AS autor_postagem
       FROM doacao d
       JOIN postagem p ON d.ID_postagem = p.ID_postagem
       JOIN usuario u ON p.ID_usuario = u.ID_usuario
       WHERE d.ID_doacao = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Doação não encontrada" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao buscar doação" });
  }
}

// POST criar doação
export async function createDoacao(req, res) {
  const { descricao, ID_postagem } = req.body;
  if (!descricao || !ID_postagem) {
    return res
      .status(400)
      .json({ error: "Campos obrigatórios: descricao, ID_postagem" });
  }
  try {
    const [ins] = await pool.query(
      "INSERT INTO doacao (descricao, ID_postagem) VALUES (?, ?)",
      [descricao, ID_postagem]
    );
    const [rows] = await pool.query(
      "SELECT * FROM doacao WHERE ID_doacao = ?",
      [ins.insertId]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao criar doação" });
  }
}

// PUT atualizar doação
export async function updateDoacao(req, res) {
  const { id } = req.params;
  const { descricao, ID_postagem } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE doacao SET descricao=?, ID_postagem=? WHERE ID_doacao=?",
      [descricao, ID_postagem, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Doação não encontrada" });
    const [rows] = await pool.query(
      "SELECT * FROM doacao WHERE ID_doacao = ?",
      [id]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao atualizar doação" });
  }
}

// DELETE doação
export async function deleteDoacao(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      "DELETE FROM doacao WHERE ID_doacao = ?",
      [id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Doação não encontrada" });
    res.json({ message: "Doação excluída com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir doação" });
  }
}
