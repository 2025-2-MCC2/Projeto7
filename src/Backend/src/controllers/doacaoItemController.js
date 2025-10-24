import { pool } from "../db.js";

// GET todas doações em itens
export async function getDoacoesItem(_, res) {
  try {
    const [rows] = await pool.query(`
      SELECT d.ID_doacao, di.item_doacao, di.quantidade, di.unidade,
             d.descricao, d.doacao_data_registro, p.conteudo AS postagem_conteudo, u.nome_usuario AS autor_postagem
      FROM doacao_item di
      JOIN doacao d ON di.ID_doacao = d.ID_doacao
      JOIN postagem p ON d.ID_postagem = p.ID_postagem
      JOIN usuario u ON p.ID_usuario = u.ID_usuario
      ORDER BY d.ID_doacao DESC
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erro ao listar doações em itens" });
  }
}

// GET doação em item por id
export async function getDoacaoItemById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT d.ID_doacao, di.item_doacao, di.quantidade, di.unidade,
              d.descricao, d.doacao_data_registro, p.conteudo AS postagem_conteudo, u.nome_usuario AS autor_postagem
       FROM doacao_item di
       JOIN doacao d ON di.ID_doacao = d.ID_doacao
       JOIN postagem p ON d.ID_postagem = p.ID_postagem
       JOIN usuario u ON p.ID_usuario = u.ID_usuario
       WHERE di.ID_doacao = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Doação em item não encontrada" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao buscar doação em item" });
  }
}

// POST criar doação em item
export async function createDoacaoItem(req, res) {
  const { ID_doacao, ID_grupo, item_doacao, quantidade, unidade, descricao, ID_postagem } = req.body;

  if (!item_doacao || !quantidade || !unidade) {
    return res.status(400).json({ error: "Campos obrigatórios: item_doacao, quantidade, unidade" });
  }
  if (!ID_doacao && !ID_grupo) {
    return res.status(400).json({ error: "Envie ID_doacao OU ID_grupo" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Se não veio ID_doacao, cria base
    let baseId = ID_doacao;
    if (!baseId) {
      const [ins] = await conn.query(
        `INSERT INTO doacao (ID_grupo, descricao, ID_postagem)
         VALUES (?, ?, ?)`,
        [ID_grupo, descricao ?? null, ID_postagem ?? null]
      );
      baseId = ins.insertId;
    }

    await conn.query(
      `INSERT INTO doacao_item (ID_doacao, item_doacao, quantidade, unidade)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE item_doacao=VALUES(item_doacao),
                               quantidade=VALUES(quantidade),
                               unidade=VALUES(unidade)`,
      [baseId, item_doacao, Number(quantidade), unidade]
    );

    await conn.commit();

    const [[row]] = await pool.query(
      `SELECT d.ID_doacao, d.ID_grupo, d.descricao, d.doacao_data_registro,
              di.item_doacao, di.quantidade, di.unidade
         FROM doacao d
         JOIN doacao_item di ON di.ID_doacao = d.ID_doacao
        WHERE d.ID_doacao = ?`,
      [baseId]
    );
    res.status(ID_doacao ? 200 : 201).json(row);
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: "Erro ao criar doação em item" });
  } finally {
    conn.release();
  }
}

// PUT atualizar doação em item
export async function updateDoacaoItem(req, res) {
  const { id } = req.params;
  const { item_doacao, quantidade, unidade } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE doacao_item SET item_doacao=?, quantidade=?, unidade=? WHERE ID_doacao=?",
      [item_doacao, quantidade, unidade, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Doação em item não encontrada" });
    const [rows] = await pool.query(
      "SELECT * FROM doacao_item WHERE ID_doacao = ?",
      [id]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao atualizar doação em item" });
  }
}

// DELETE doação em item
export async function deleteDoacaoItem(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      "DELETE FROM doacao_item WHERE ID_doacao = ?",
      [id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Doação em item não encontrada" });
    res.json({ message: "Doação em item excluída com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir doação em item" });
  }
}
