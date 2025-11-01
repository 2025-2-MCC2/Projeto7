// controllers/grupoController.js
import { pool } from "../DataBase/db.js";
import { saveBase64AsFile } from "../services/fileUtils.js";

/**
 * Converte row do banco + dados calculados -> objeto esperado pela UI
 * AGORA inclui progressoArrecadacao e progressoAlimentos calculados.
 */
function mapToClient(row, membros = [], progressoArrecadacao = 0, progressoAlimentos = 0) {
  return {
    id: row.ID_grupo,
    nome: row.nome_grupo,
    metaArrecadacao: Number(row.meta_arrecadacao ?? 0),
    metaAlimentos: row.meta_alimentos ?? "",
    capaDataUrl: row.capa_url ?? "",
    capaUrl: row.capa_url ?? "",
    mentor: row.mentor ?? undefined,
    mentorFotoUrl: row.mentor_foto_url ?? undefined,
    membros,
    progressoArrecadacao: Number(progressoArrecadacao ?? 0),
    progressoAlimentos: Number(progressoAlimentos ?? 0),
  };
}

// GET /grupos
export async function getGrupos(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT *, (SELECT foto_url FROM usuario WHERE ID_usuario = grupo.mentor_id) AS mentor_foto_real 
       FROM grupo ORDER BY ID_grupo DESC`
    );
    if (!rows.length) return res.json([]);

    const grupoIds = rows.map((g) => g.ID_grupo);

    const [mrows] = await pool.query(
      `SELECT ID_grupo, nome, ra, telefone
         FROM grupo_membro
        WHERE ID_grupo IN (?)
        ORDER BY ID_grupo ASC, nome ASC`,
      [grupoIds]
    );

    const [moneyProgressRows] = await pool.query(
      `SELECT ID_grupo, COALESCE(SUM(valor_doacao), 0) AS total_arrecadado
         FROM doacao
        WHERE ID_grupo IN (?)
          AND tipo_doacao = 'dinheiro'
          AND status_doacao = 'aprovada'
        GROUP BY ID_grupo`,
      [grupoIds]
    );

    const [itemProgressRows] = await pool.query(
      `SELECT ID_grupo, COALESCE(SUM(quantidade), 0) AS total_itens
         FROM doacao
        WHERE ID_grupo IN (?)
          AND tipo_doacao = 'item'
          AND status_doacao = 'aprovada'
        GROUP BY ID_grupo`,
      [grupoIds]
    );

    const memMap = new Map();
    for (const m of mrows) {
      const arr = memMap.get(m.ID_grupo) ?? [];
      arr.push({ nome: m.nome, ra: m.ra, telefone: m.telefone ?? "" });
      memMap.set(m.ID_grupo, arr);
    }

    const moneyProgressMap = new Map(moneyProgressRows.map((p) => [p.ID_grupo, p.total_arrecadado]));
    const itemProgressMap = new Map(itemProgressRows.map((p) => [p.ID_grupo, p.total_itens]));

    const out = rows.map((r) => {
      r.mentor_foto_url = r.mentor_foto_real || r.mentor_foto_url;
      return mapToClient(
        r,
        memMap.get(r.ID_grupo) ?? [],
        moneyProgressMap.get(r.ID_grupo) ?? 0,
        itemProgressMap.get(r.ID_grupo) ?? 0
      );
    });

    res.json(out);
  } catch (e) {
    console.error("Erro em getGrupos:", e);
    res.status(500).json({ error: "Erro ao listar grupos" });
  }
}

// GET /grupos/:id
export async function getGrupoById(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT *, (SELECT foto_url FROM usuario WHERE ID_usuario = grupo.mentor_id) AS mentor_foto_real 
       FROM grupo WHERE ID_grupo=?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Grupo não encontrado" });
    const row = rows[0];
    row.mentor_foto_url = row.mentor_foto_real || row.mentor_foto_url;

    const [mrows] = await pool.query(
      `SELECT nome, ra, telefone
         FROM grupo_membro
        WHERE ID_grupo=?
        ORDER BY nome ASC`,
      [id]
    );
    const membros = (mrows ?? []).map((m) => ({
      nome: m.nome,
      ra: m.ra,
      telefone: m.telefone ?? "",
    }));

    const [[moneyProgress]] = await pool.query(
      `SELECT COALESCE(SUM(valor_doacao), 0) AS total_arrecadado
         FROM doacao
        WHERE ID_grupo = ? AND tipo_doacao = 'dinheiro' AND status_doacao = 'aprovada'`,
      [id]
    );

    const [[itemProgress]] = await pool.query(
      `SELECT COALESCE(SUM(quantidade), 0) AS total_itens
         FROM doacao
        WHERE ID_grupo = ? AND tipo_doacao = 'item' AND status_doacao = 'aprovada'`,
      [id]
    );

    res.json(
      mapToClient(row, membros, moneyProgress?.total_arrecadado ?? 0, itemProgress?.total_itens ?? 0)
    );
  } catch (e) {
    console.error(`Erro em getGrupoById(${id}):`, e);
    res.status(500).json({ error: "Erro ao buscar grupo" });
  }
}

// POST /grupos
export async function createGrupo(req, res) {
  const { nome, metaArrecadacao, metaAlimentos, membros, mentor, mentorFotoUrl, capaDataUrl } =
    req.body;

  if (!nome?.trim()) {
    return res.status(400).json({ error: "Campo 'nome' é obrigatório." });
  }

  const conn = await pool.getConnection();
  let groupId = null;

  try {
    await conn.beginTransaction();

    const [ins] = await conn.query(
      `INSERT INTO grupo (nome_grupo, meta_arrecadacao, meta_alimentos, mentor, mentor_foto_url)
       VALUES (?, ?, ?, ?, ?)`,
      [nome.trim(), Number(metaArrecadacao ?? 0), metaAlimentos || null, mentor || null, mentorFotoUrl || null]
    );
    groupId = ins.insertId;

    const validMembers = Array.isArray(membros)
      ? membros.filter((m) => m?.nome && m?.ra)
      : [];

    if (validMembers.length) {
      const values = validMembers.map((m) => [groupId, m.nome, String(m.ra), m.telefone ?? null]);
      await conn.query(`INSERT INTO grupo_membro (ID_grupo, nome, ra, telefone) VALUES ?`, [values]);
    }

    let finalCapaUrl = null;
    if (capaDataUrl) {
      finalCapaUrl = await saveBase64AsFile(capaDataUrl, `capa_grupo_${groupId}`);
      await conn.query(`UPDATE grupo SET capa_url = ? WHERE ID_grupo = ?`, [finalCapaUrl, groupId]);
    }

    await conn.commit();

    const grupoCriado = {
      ID_grupo: groupId,
      nome_grupo: nome.trim(),
      meta_arrecadacao: Number(metaArrecadacao ?? 0),
      meta_alimentos: metaAlimentos || null,
      capa_url: finalCapaUrl,
      mentor: mentor || null,
      mentor_foto_url: mentorFotoUrl || null,
    };

    res
      .status(201)
      .json(
        mapToClient(grupoCriado, validMembers.map((m) => ({ ...m, telefone: m.telefone ?? "" })))
      );
  } catch (e) {
    await conn.rollback();
    console.error("Erro em createGrupo:", e);
    res.status(500).json({ error: "Erro ao criar grupo" });
  } finally {
    conn.release();
  }
}

// PUT /grupos/:id
export async function updateGrupo(req, res) {
  const { id } = req.params;
  const { nome, metaArrecadacao, metaAlimentos, membros, mentor, mentorFotoUrl, capaDataUrl } =
    req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const fields = [];
    const params = [];

    if (nome !== undefined) {
      fields.push("nome_grupo=?");
      params.push(nome?.trim() || null);
    }
    if (metaArrecadacao !== undefined) {
      fields.push("meta_arrecadacao=?");
      params.push(Number(metaArrecadacao ?? 0));
    }
    if (metaAlimentos !== undefined) {
      fields.push("meta_alimentos=?");
      params.push(metaAlimentos || null);
    }
    if (mentor !== undefined) {
      fields.push("mentor=?");
      params.push(mentor || null);
    }
    if (mentorFotoUrl !== undefined) {
      fields.push("mentor_foto_url=?");
      params.push(mentorFotoUrl || null);
    }

    if (capaDataUrl !== undefined) {
      if (capaDataUrl) {
        const finalCapaUrl = await saveBase64AsFile(capaDataUrl, `capa_grupo_${id}`);
        fields.push("capa_url=?");
        params.push(finalCapaUrl);
      } else {
        fields.push("capa_url=?");
        params.push(null);
      }
    }

    if (fields.length) {
      params.push(id);
      await conn.query(`UPDATE grupo SET ${fields.join(", ")} WHERE ID_grupo=?`, params);
    }

    let membrosOut;
    if (Array.isArray(membros)) {
      await conn.query(`DELETE FROM grupo_membro WHERE ID_grupo=?`, [id]);
      const valid = membros.filter((m) => m?.nome && m?.ra);
      if (valid.length) {
        const values = valid.map((m) => [id, m.nome, String(m.ra), m.telefone ?? null]);
        await conn.query(`INSERT INTO grupo_membro (ID_grupo, nome, ra, telefone) VALUES ?`, [
          values,
        ]);
      }
      membrosOut = valid.map((m) => ({ ...m, telefone: m.telefone ?? "" }));
    }

    await conn.commit();

    const [rows] = await pool.query(
      `SELECT *, (SELECT foto_url FROM usuario WHERE ID_usuario = grupo.mentor_id) AS mentor_foto_real
       FROM grupo WHERE ID_grupo=?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Grupo não encontrado" });
    const row = rows[0];
    row.mentor_foto_url = row.mentor_foto_real || row.mentor_foto_url;

    if (!membrosOut) {
      const [mrows] = await pool.query(
        `SELECT nome, ra, telefone FROM grupo_membro WHERE ID_grupo=? ORDER BY nome ASC`,
        [id]
      );
      membrosOut = (mrows ?? []).map((m) => ({
        nome: m.nome,
        ra: m.ra,
        telefone: m.telefone ?? "",
      }));
    }

    const [[moneyProgress]] = await pool.query(
      `SELECT COALESCE(SUM(valor_doacao), 0) AS total_arrecadado
         FROM doacao WHERE ID_grupo = ? AND tipo_doacao = 'dinheiro' AND status_doacao = 'aprovada'`,
      [id]
    );

    const [[itemProgress]] = await pool.query(
      `SELECT COALESCE(SUM(quantidade), 0) AS total_itens
         FROM doacao WHERE ID_grupo = ? AND tipo_doacao = 'item' AND status_doacao = 'aprovada'`,
      [id]
    );

    res.json(
      mapToClient(
        row,
        membrosOut,
        moneyProgress?.total_arrecadado ?? 0,
        itemProgress?.total_itens ?? 0
      )
    );
  } catch (e) {
    await conn.rollback();
    console.error(`Erro em updateGrupo(${id}):`, e);
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
  } catch (e) {
    console.error(`Erro em deleteGrupo(${id}):`, e);
    res.status(500).json({ error: "Erro ao excluir grupo" });
  }
}
