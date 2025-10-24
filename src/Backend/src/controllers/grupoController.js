// controllers/grupoController.js
import { pool } from "../db.js";

/** Converte row do banco -> objeto esperado pela UI */
function mapToClient(row, membros = []) {
  return {
    id: row.ID_grupo,
    nome: row.nome_grupo,                       // <- mapeia nome_grupo -> nome
    metaArrecadacao: Number(row.meta_arrecadacao ?? 0),
    metaAlimentos: row.meta_alimentos ?? "",
    capaDataUrl: row.capa_url ?? "",            // reservado caso use imagem depois
    mentor: undefined,                          // ligaremos a tabela usuario depois
    mentorFotoUrl: undefined,
    membros,                                    // [{nome, ra, telefone}]
    progressoArrecadacao: 0,                    // passa a vir das doações aprovadas
    inventario: [],                             // idem (quando ligarmos doações de item)
  };
}

// GET /grupos
export async function getGrupos(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM grupo ORDER BY ID_grupo DESC`
    );
    if (!rows.length) return res.json([]);

    const ids = rows.map(g => g.ID_grupo);
    const [mrows] = await pool.query(
      `SELECT ID_grupo, nome, ra, telefone
         FROM grupo_membro
        WHERE ID_grupo IN (?)
        ORDER BY ID_grupo ASC, nome ASC`,
      [ids]
    );

    const memMap = new Map();
    for (const m of mrows) {
      const arr = memMap.get(m.ID_grupo) ?? [];
      arr.push({ nome: m.nome, ra: m.ra, telefone: m.telefone ?? "" });
      memMap.set(m.ID_grupo, arr);
    }

    const out = rows.map(r => mapToClient(r, memMap.get(r.ID_grupo) ?? []));
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: "Erro ao listar grupos" });
  }
}

// GET /grupos/:id
export async function getGrupoById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM grupo WHERE ID_grupo=?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Grupo não encontrado" });

    const [mrows] = await pool.query(
      `SELECT nome, ra, telefone
         FROM grupo_membro
        WHERE ID_grupo=?
        ORDER BY nome ASC`,
      [id]
    );

    const membros = (mrows ?? []).map(m => ({
      nome: m.nome, ra: m.ra, telefone: m.telefone ?? ""
    }));

    res.json(mapToClient(rows[0], membros));
  } catch {
    res.status(500).json({ error: "Erro ao buscar grupo" });
  }
}

// POST /grupos
// body: { nome, metaArrecadacao, metaAlimentos, membros:[{nome,ra,telefone?}] }
export async function createGrupo(req, res) {
  const { nome, metaArrecadacao, metaAlimentos, membros } = req.body;

  if (!nome?.trim()) {
    return res.status(400).json({ error: "Campo 'nome' é obrigatório." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [ins] = await conn.query(
      `INSERT INTO grupo (nome_grupo, meta_arrecadacao, meta_alimentos)
       VALUES (?, ?, ?)`,
      [nome.trim(), Number(metaArrecadacao ?? 0), metaAlimentos ?? null]
    );
    const groupId = ins.insertId;

    const validMembers = Array.isArray(membros)
      ? membros.filter(m => m?.nome && m?.ra)
      : [];
    if (validMembers.length) {
      const values = validMembers.map(m => [groupId, m.nome, String(m.ra), m.telefone ?? null]);
      await conn.query(
        `INSERT INTO grupo_membro (ID_grupo, nome, ra, telefone) VALUES ?`,
        [values]
      );
    }

    await conn.commit();

    const [[row]] = await pool.query(
      `SELECT * FROM grupo WHERE ID_grupo=?`, [groupId]
    );
    res.status(201).json(mapToClient(row, validMembers.map(m => ({...m, telefone: m.telefone ?? ""}))));
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: "Erro ao criar grupo" });
  } finally {
    conn.release();
  }
}

// PUT /grupos/:id
// body parcial: { nome?, metaArrecadacao?, metaAlimentos?, membros? (substitui lista) }
export async function updateGrupo(req, res) {
  const { id } = req.params;
  const { nome, metaArrecadacao, metaAlimentos, membros } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const fields = [];
    const params = [];
    if (nome !== undefined) { fields.push("nome_grupo=?"); params.push(nome?.trim() || null); }
    if (metaArrecadacao !== undefined) { fields.push("meta_arrecadacao=?"); params.push(Number(metaArrecadacao ?? 0)); }
    if (metaAlimentos !== undefined) { fields.push("meta_alimentos=?"); params.push(metaAlimentos || null); }

    if (fields.length) {
      params.push(id);
      await conn.query(`UPDATE grupo SET ${fields.join(", ")} WHERE ID_grupo=?`, params);
    }

    let membrosOut;
    if (Array.isArray(membros)) {
      await conn.query(`DELETE FROM grupo_membro WHERE ID_grupo=?`, [id]);
      const valid = membros.filter(m => m?.nome && m?.ra);
      if (valid.length) {
        const values = valid.map(m => [id, m.nome, String(m.ra), m.telefone ?? null]);
        await conn.query(
          `INSERT INTO grupo_membro (ID_grupo, nome, ra, telefone) VALUES ?`,
          [values]
        );
      }
      membrosOut = valid.map(m => ({ ...m, telefone: m.telefone ?? "" }));
    }

    await conn.commit();

    const [[row]] = await pool.query(`SELECT * FROM grupo WHERE ID_grupo=?`, [id]);
    if (!row) return res.status(404).json({ error: "Grupo não encontrado" });

    if (!membrosOut) {
      const [mrows] = await pool.query(
        `SELECT nome, ra, telefone FROM grupo_membro WHERE ID_grupo=? ORDER BY nome ASC`,
        [id]
      );
      membrosOut = (mrows ?? []).map(m => ({ nome: m.nome, ra: m.ra, telefone: m.telefone ?? "" }));
    }

    res.json(mapToClient(row, membrosOut));
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: "Erro ao atualizar grupo" });
  } finally {
    conn.release();
  }
}

// DELETE /grupos/:id
export async function deleteGrupo(req, res) {
  const { id } = req.params;
  try {
    const [r] = await pool.query(`DELETE FROM grupo WHERE ID_grupo=?`, [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: "Grupo não encontrado" });
    res.json({ message: "Grupo excluído com sucesso" });
  } catch {
    res.status(500).json({ error: "Erro ao excluir grupo" });
  }
}