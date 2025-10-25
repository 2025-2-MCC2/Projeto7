import { pool } from "../DataBase/db.js";

// GET todas doações em dinheiro
export async function getDoacoesDinheiro(_, res) {
  try {
    const [rows] = await pool.query(`
      SELECT d.ID_doacao, dd.valor_doacao, d.descricao, d.doacao_data_registro,
             p.conteudo AS postagem_conteudo, u.nome_usuario AS autor_postagem
      FROM doacao_dinheiro dd
      JOIN doacao d ON dd.ID_doacao = d.ID_doacao
      JOIN postagem p ON d.ID_postagem = p.ID_postagem
      JOIN usuario u ON p.ID_usuario = u.ID_usuario
      ORDER BY d.ID_doacao DESC
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar doações em dinheiro" });
  }
}

// GET doação em dinheiro por id
export async function getDoacaoDinheiroById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT d.ID_doacao, dd.valor_doacao, d.descricao, d.doacao_data_registro,
              p.conteudo AS postagem_conteudo, u.nome_usuario AS autor_postagem
       FROM doacao_dinheiro dd
       JOIN doacao d ON dd.ID_doacao = d.ID_doacao
       JOIN postagem p ON d.ID_postagem = p.ID_postagem
       JOIN usuario u ON p.ID_usuario = u.ID_usuario
       WHERE dd.ID_doacao = ?`,
      [id]
    );
    if (rows.length === 0)
      return res
        .status(404)
        .json({ error: "Doação em dinheiro não encontrada" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao buscar doação em dinheiro" });
  }
}

// POST criar doação em dinheiro
export async function createDoacaoDinheiro(req, res) {
  const { ID_doacao, ID_grupo, valor_doacao, descricao, ID_postagem } = req.body;

  if (!valor_doacao) {
    return res.status(400).json({ error: "Campo obrigatório: valor_doacao" });
  }
  if (!ID_doacao && !ID_grupo) {
    return res.status(400).json({ error: "Envie ID_doacao OU ID_grupo" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Se não veio ID_doacao, cria base em 'doacao'
    let baseId = ID_doacao;
    if (!baseId) {
      const [ins] = await conn.query(
        `INSERT INTO doacao (ID_grupo, descricao, ID_postagem)
         VALUES (?, ?, ?)`,
        [ID_grupo, descricao ?? null, ID_postagem ?? null]
      );
      baseId = ins.insertId;
    }

    // Insere/atualiza detalhe em doacao_dinheiro
    await conn.query(
      `INSERT INTO doacao_dinheiro (ID_doacao, valor_doacao)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE valor_doacao=VALUES(valor_doacao)`,
      [baseId, Number(valor_doacao)]
    );

    await conn.commit();

    // Retorna a doação completa (base + dinheiro)
    const [[row]] = await pool.query(
      `SELECT d.ID_doacao, d.ID_grupo, d.descricao, d.doacao_data_registro,
              dd.valor_doacao
         FROM doacao d
         JOIN doacao_dinheiro dd ON dd.ID_doacao = d.ID_doacao
        WHERE d.ID_doacao = ?`,
      [baseId]
    );
    res.status(ID_doacao ? 200 : 201).json(row);
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: "Erro ao criar doação em dinheiro" });
  } finally {
    conn.release();
  }
}

// PUT atualizar doação em dinheiro
export async function updateDoacaoDinheiro(req, res) {
  const { id } = req.params;
  const { valor_doacao } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE doacao_dinheiro SET valor_doacao=? WHERE ID_doacao=?",
      [valor_doacao, id]
    );
    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ error: "Doação em dinheiro não encontrada" });
    const [rows] = await pool.query(
      "SELECT * FROM doacao_dinheiro WHERE ID_doacao = ?",
      [id]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao atualizar doação em dinheiro" });
  }
}

// DELETE doação em dinheiro
export async function deleteDoacaoDinheiro(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      "DELETE FROM doacao_dinheiro WHERE ID_doacao = ?",
      [id]
    );
    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ error: "Doação em dinheiro não encontrada" });
    res.json({ message: "Doação em dinheiro excluída com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir doação em dinheiro" });
  }
}
