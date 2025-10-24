// controllers/doacaoController.js
import { pool } from "../db.js";
import { pushDashboardUpdate } from "../services/sse.js";

// Utilitário simples para validar payloads
function isMoney(d) {
  return d.tipo === "dinheiro";
}
function isItem(d) {
  return d.tipo === "item";
}

// GET /api/grupos/:grupoId/doacoes?status=pendente|aprovada|rejeitada|todas
export async function listDoacoesByGrupo(req, res) {
  const { grupoId } = req.params;
  const { status = "todas" } = req.query;
  try {
    const params = [grupoId];
    let where = "WHERE d.ID_grupo = ?";
    if (status !== "todas") {
      where += " AND d.status = ?";
      params.push(status);
    }
    const [rows] = await pool.query(
      `
      SELECT d.*
      FROM doacao d
      ${where}
      ORDER BY d.ID_doacao DESC
      `,
      params
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Erro ao listar doações" });
  }
}

// GET /api/grupos/:grupoId/doacoes/:id
export async function getDoacao(req, res) {
  const { grupoId, id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT d.* FROM doacao d WHERE d.ID_doacao = ? AND d.ID_grupo = ?`,
      [id, grupoId]
    );
    if (!rows.length) return res.status(404).json({ error: "Doação não encontrada" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao buscar doação" });
  }
}

// POST /api/grupos/:grupoId/doacoes  (cria PENDENTE)
export async function createDoacao(req, res) {
  const { grupoId } = req.params;
  const {
    tipo, descricao,
    doador_nome,
    // dinheiro:
    valor,
    // item:
    item_nome, quantidade, unidade, peso_kg,
    ID_postagem // opcional
  } = req.body;

  if (!tipo || !["dinheiro", "item"].includes(tipo)) {
    return res.status(400).json({ error: "Campo 'tipo' deve ser 'dinheiro' ou 'item'." });
  }
  if (isMoney({ tipo }) && (valor == null || isNaN(Number(valor)) || Number(valor) <= 0)) {
    return res.status(400).json({ error: "Para doação em dinheiro, informe 'valor' > 0." });
  }
  if (isItem({ tipo }) && (!item_nome || !quantidade || Number(quantidade) <= 0)) {
    return res.status(400).json({ error: "Para doação de item, informe 'item_nome' e 'quantidade' > 0." });
  }

  try {
    const [ins] = await pool.query(
      `INSERT INTO doacao
       (ID_grupo, tipo, descricao, doador_nome, valor, item_nome, quantidade, unidade, peso_kg, status, ID_postagem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?)`,
      [
        grupoId, tipo, descricao ?? null, doador_nome ?? null,
        isMoney({ tipo }) ? Number(valor) : null,
        isItem({ tipo }) ? item_nome : null,
        isItem({ tipo }) ? Number(quantidade) : null,
        isItem({ tipo }) ? (unidade ?? null) : null,
        isItem({ tipo }) ? (peso_kg ? Number(peso_kg) : null) : null,
        ID_postagem ?? null
      ]
    );
    const [rows] = await pool.query(`SELECT * FROM doacao WHERE ID_doacao = ?`, [ins.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: "Erro ao criar doação" });
  }
}

// PUT /api/grupos/:grupoId/doacoes/:id  (editar enquanto pendente)
export async function updateDoacao(req, res) {
  const { grupoId, id } = req.params;
  const {
    descricao, doador_nome,
    valor, item_nome, quantidade, unidade, peso_kg
  } = req.body;

  try {
    // Impede edição após aprovada/rejeitada
    const [chk] = await pool.query(
      `SELECT status, tipo FROM doacao WHERE ID_doacao = ? AND ID_grupo = ?`,
      [id, grupoId]
    );
    if (!chk.length) return res.status(404).json({ error: "Doação não encontrada" });
    if (chk[0].status !== "pendente") {
      return res.status(400).json({ error: "Somente doações pendentes podem ser editadas." });
    }

    const fields = [];
    const params = [];
    if (descricao !== undefined) { fields.push("descricao=?"); params.push(descricao); }
    if (doador_nome !== undefined) { fields.push("doador_nome=?"); params.push(doador_nome); }

    if (chk[0].tipo === "dinheiro") {
      if (valor !== undefined) { fields.push("valor=?"); params.push(valor ? Number(valor) : null); }
      // Zera campos de item por consistência
      fields.push("item_nome=NULL, quantidade=NULL, unidade=NULL, peso_kg=NULL");
    } else {
      if (item_nome !== undefined) { fields.push("item_nome=?"); params.push(item_nome || null); }
      if (quantidade !== undefined) { fields.push("quantidade=?"); params.push(quantidade ? Number(quantidade) : null); }
      if (unidade !== undefined) { fields.push("unidade=?"); params.push(unidade || null); }
      if (peso_kg !== undefined) { fields.push("peso_kg=?"); params.push(peso_kg ? Number(peso_kg) : null); }
      // Zera campo de valor
      fields.push("valor=NULL");
    }

    if (!fields.length) return res.json({ message: "Nada a atualizar" });

    params.push(id, grupoId);
    const [result] = await pool.query(
      `UPDATE doacao SET ${fields.join(", ")} WHERE ID_doacao=? AND ID_grupo=?`,
      params
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Doação não encontrada" });

    const [rows] = await pool.query(`SELECT * FROM doacao WHERE ID_doacao = ?`, [id]);
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao atualizar doação" });
  }
}

// PUT /api/grupos/:grupoId/doacoes/:id/aprovar
export async function approveDoacao(req, res) {
  const { grupoId, id } = req.params;
  // Em produção, pegue o ID do mentor autenticado no token/session
  const mentorId = req.user?.ID_usuario ?? null;
  try {
    const [chk] = await pool.query(
      `SELECT status FROM doacao WHERE ID_doacao = ? AND ID_grupo = ?`,
      [id, grupoId]
    );
    if (!chk.length) return res.status(404).json({ error: "Doação não encontrada" });
    if (chk[0].status !== "pendente") {
      return res.status(400).json({ error: "Apenas doações pendentes podem ser aprovadas." });
    }
    await pool.query(
      `UPDATE doacao
       SET status='aprovada', aprovada_em=NOW(), aprovada_por=?
       WHERE ID_doacao=? AND ID_grupo=?`,
      [mentorId, id, grupoId]
    );

    // Dispara atualização em tempo real da dashboard do grupo
    pushDashboardUpdate(grupoId, { type: "dashboard_updated", grupoId: Number(grupoId) });

    const [rows] = await pool.query(`SELECT * FROM doacao WHERE ID_doacao=?`, [id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: "Erro ao aprovar doação" });
  }
}

// PUT /api/grupos/:grupoId/doacoes/:id/rejeitar
export async function rejectDoacao(req, res) {
  const { grupoId, id } = req.params;
  const { observacao } = req.body;
  try {
    const [chk] = await pool.query(
      `SELECT status FROM doacao WHERE ID_doacao = ? AND ID_grupo = ?`,
      [id, grupoId]
    );
    if (!chk.length) return res.status(404).json({ error: "Doação não encontrada" });
    if (chk[0].status !== "pendente") {
      return res.status(400).json({ error: "Apenas doações pendentes podem ser rejeitadas." });
    }
    await pool.query(
      `UPDATE doacao SET status='rejeitada', observacao=? WHERE ID_doacao=? AND ID_grupo=?`,
      [observacao ?? null, id, grupoId]
    );
    pushDashboardUpdate(grupoId, { type: "dashboard_updated", grupoId: Number(grupoId) });
    const [rows] = await pool.query(`SELECT * FROM doacao WHERE ID_doacao=?`, [id]);
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Erro ao rejeitar doação" });
  }
}

// DELETE /api/grupos/:grupoId/doacoes/:id  (se pendente; ou regra administrativa)
export async function deleteDoacao(req, res) {
  const { grupoId, id } = req.params;
  try {
    const [result] = await pool.query(
      `DELETE FROM doacao WHERE ID_doacao=? AND ID_grupo=? AND status='pendente'`,
      [id, grupoId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Doação não encontrada ou não está pendente" });
    }
    res.json({ message: "Doação excluída com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir doação" });
  }
}