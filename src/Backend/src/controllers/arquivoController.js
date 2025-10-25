import { pool } from "../DataBase/db.js";

// GET todos os arquivos
export async function getArquivos(_, res) {
  try {
    const [rows] = await pool.query(`
      SELECT a.ID_arquivo, a.tipo_arquivo, a.caminho_arquivo,
             d.descricao AS doacao_descricao, p.conteudo AS postagem_conteudo, u.nome_usuario AS autor_postagem
      FROM arquivo a
      JOIN doacao d ON a.ID_doacao = d.ID_doacao
      JOIN postagem p ON a.ID_postagem = p.ID_postagem
      JOIN usuario u ON p.ID_usuario = u.ID_usuario
      ORDER BY a.ID_arquivo DESC
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar arquivos" });
  }
}

// GET arquivo por id
export async function getArquivoById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT a.ID_arquivo, a.tipo_arquivo, a.caminho_arquivo,
              d.descricao AS doacao_descricao, p.conteudo AS postagem_conteudo, u.nome_usuario AS autor_postagem
       FROM arquivo a
       JOIN doacao d ON a.ID_doacao = d.ID_doacao
       JOIN postagem p ON a.ID_postagem = p.ID_postagem
       JOIN usuario u ON p.ID_usuario = u.ID_usuario
       WHERE a.ID_arquivo = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Arquivo não encontrado" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao buscar arquivo" });
  }
}

// POST criar arquivo
export async function createArquivo(req, res) {
  const { tipo_arquivo, caminho_arquivo, ID_doacao, ID_postagem } = req.body;
  if (!tipo_arquivo || !caminho_arquivo || !ID_doacao || !ID_postagem) {
    return res
      .status(400)
      .json({
        error:
          "Campos obrigatórios: tipo_arquivo, caminho_arquivo, ID_doacao, ID_postagem",
      });
  }
  try {
    const [ins] = await pool.query(
      "INSERT INTO arquivo (tipo_arquivo, caminho_arquivo, ID_doacao, ID_postagem) VALUES (?, ?, ?, ?)",
      [tipo_arquivo, caminho_arquivo, ID_doacao, ID_postagem]
    );
    const [rows] = await pool.query(
      "SELECT * FROM arquivo WHERE ID_arquivo = ?",
      [ins.insertId]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao criar arquivo" });
  }
}

// PUT atualizar arquivo
export async function updateArquivo(req, res) {
  const { id } = req.params;
  const { tipo_arquivo, caminho_arquivo, ID_doacao, ID_postagem } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE arquivo SET tipo_arquivo=?, caminho_arquivo=?, ID_doacao=?, ID_postagem=? WHERE ID_arquivo=?",
      [tipo_arquivo, caminho_arquivo, ID_doacao, ID_postagem, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Arquivo não encontrado" });
    const [rows] = await pool.query(
      "SELECT * FROM arquivo WHERE ID_arquivo = ?",
      [id]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao atualizar arquivo" });
  }
}

// DELETE arquivo
export async function deleteArquivo(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      "DELETE FROM arquivo WHERE ID_arquivo = ?",
      [id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Arquivo não encontrado" });
    res.json({ message: "Arquivo excluído com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir arquivo" });
  }
}
