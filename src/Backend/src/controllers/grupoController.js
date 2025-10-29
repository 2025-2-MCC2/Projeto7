// controllers/grupoController.js
import { pool } from "../DataBase/db.js"; //

/**
 * Converte row do banco + dados calculados -> objeto esperado pela UI
 * AGORA inclui progressoArrecadacao e progressoAlimentos calculados.
 */
function mapToClient(row, membros = [], progressoArrecadacao = 0, progressoAlimentos = 0) {
  return {
    id: row.ID_grupo, //
    nome: row.nome_grupo, // <- Mapeia nome_grupo -> nome
    metaArrecadacao: Number(row.meta_arrecadacao ?? 0), //
    metaAlimentos: row.meta_alimentos ?? "", //
    capaDataUrl: row.capa_url ?? "", //
    // TODO: Considerar buscar dados do mentor da tabela 'usuario' se mentor_id estiver preenchido
    mentor: row.mentor ?? undefined, // (Usando o campo textual por enquanto)
    mentorFotoUrl: undefined, // (Precisaria buscar na tabela usuario)
    membros, // [{nome, ra, telefone}]
    progressoArrecadacao: Number(progressoArrecadacao ?? 0), // <<< CALCULADO AGORA
    // inventario: [], // <<< Removido, pois o Dashboard busca isso separadamente. Se precisar, calcular aqui.
    progressoAlimentos: Number(progressoAlimentos ?? 0), // <<< NOVO CAMPO CALCULADO
  };
}

// GET /grupos
export async function getGrupos(_req, res) { //
  try {
    // 1. Buscar todos os grupos
    const [rows] = await pool.query(
      `SELECT * FROM grupo ORDER BY ID_grupo DESC` //
    );
    if (!rows.length) return res.json([]);

    const grupoIds = rows.map(g => g.ID_grupo);

    // 2. Buscar todos os membros para esses grupos
    const [mrows] = await pool.query( //
      `SELECT ID_grupo, nome, ra, telefone
         FROM grupo_membro
        WHERE ID_grupo IN (?)
        ORDER BY ID_grupo ASC, nome ASC`,
      [grupoIds]
    );

    // 3. Buscar progresso financeiro (soma de doações 'dinheiro' aprovadas)
    const [moneyProgressRows] = await pool.query(
      `SELECT ID_grupo, COALESCE(SUM(valor_doacao), 0) AS total_arrecadado
         FROM doacao
        WHERE ID_grupo IN (?)
          AND tipo_doacao = 'dinheiro'
          AND status_doacao = 'aprovada'
        GROUP BY ID_grupo`,
      [grupoIds]
    );

    // 4. Buscar progresso de itens (soma de 'quantidade' de doações 'item' aprovadas)
    //    NOTA: Isso soma quantidades independentemente da unidade ('kg', 'un', etc.)
    //          Pode ser necessário refinar essa lógica dependendo da regra de negócio.
    const [itemProgressRows] = await pool.query(
      `SELECT ID_grupo, COALESCE(SUM(quantidade), 0) AS total_itens
         FROM doacao
        WHERE ID_grupo IN (?)
          AND tipo_doacao = 'item'
          AND status_doacao = 'aprovada'
        GROUP BY ID_grupo`,
      [grupoIds]
    );

    // 5. Mapear membros e progressos para fácil acesso
    const memMap = new Map(); //
    for (const m of mrows) {
      const arr = memMap.get(m.ID_grupo) ?? [];
      arr.push({ nome: m.nome, ra: m.ra, telefone: m.telefone ?? "" }); //
      memMap.set(m.ID_grupo, arr);
    }

    const moneyProgressMap = new Map(moneyProgressRows.map(p => [p.ID_grupo, p.total_arrecadado]));
    const itemProgressMap = new Map(itemProgressRows.map(p => [p.ID_grupo, p.total_itens]));

    // 6. Montar a resposta final
    const out = rows.map(r => mapToClient( //
      r,
      memMap.get(r.ID_grupo) ?? [],
      moneyProgressMap.get(r.ID_grupo) ?? 0,
      itemProgressMap.get(r.ID_grupo) ?? 0
    ));
    res.json(out);
  } catch (e) {
    console.error("Erro em getGrupos:", e); // Adicionado log de erro
    res.status(500).json({ error: "Erro ao listar grupos" }); //
  }
}

// GET /grupos/:id
export async function getGrupoById(req, res) { //
  const { id } = req.params;
  try {
    // 1. Buscar o grupo
    const [rows] = await pool.query( //
      `SELECT * FROM grupo WHERE ID_grupo=?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Grupo não encontrado" }); //
    const row = rows[0];

    // 2. Buscar membros do grupo
    const [mrows] = await pool.query( //
      `SELECT nome, ra, telefone
         FROM grupo_membro
        WHERE ID_grupo=?
        ORDER BY nome ASC`,
      [id]
    );
    const membros = (mrows ?? []).map(m => ({ //
      nome: m.nome, ra: m.ra, telefone: m.telefone ?? ""
    }));

    // 3. Calcular progresso financeiro
    const [[moneyProgress]] = await pool.query(
      `SELECT COALESCE(SUM(valor_doacao), 0) AS total_arrecadado
         FROM doacao
        WHERE ID_grupo = ? AND tipo_doacao = 'dinheiro' AND status_doacao = 'aprovada'`,
      [id]
    );

    // 4. Calcular progresso de itens
    const [[itemProgress]] = await pool.query(
      `SELECT COALESCE(SUM(quantidade), 0) AS total_itens
         FROM doacao
        WHERE ID_grupo = ? AND tipo_doacao = 'item' AND status_doacao = 'aprovada'`,
      [id]
    );

    // 5. Montar a resposta
    res.json(mapToClient(
        row,
        membros,
        moneyProgress?.total_arrecadado ?? 0,
        itemProgress?.total_itens ?? 0
    ));
  } catch(e) { // Adicionado 'e' para log
    console.error(`Erro em getGrupoById(${id}):`, e); // Adicionado log de erro
    res.status(500).json({ error: "Erro ao buscar grupo" }); //
  }
}

// POST /grupos
// body: { nome, metaArrecadacao, metaAlimentos, membros:[{nome,ra,telefone?}] }
export async function createGrupo(req, res) { //
  const { nome, metaArrecadacao, metaAlimentos, membros, mentor, mentorFotoUrl, capaDataUrl } = req.body; // Adicionado mentor, mentorFotoUrl, capaDataUrl

  if (!nome?.trim()) { //
    return res.status(400).json({ error: "Campo 'nome' é obrigatório." }); //
  }

  const conn = await pool.getConnection(); //
  try {
    await conn.beginTransaction(); //

    // Incluído mentor e capa_url no INSERT
    const [ins] = await conn.query( //
      `INSERT INTO grupo (nome_grupo, meta_arrecadacao, meta_alimentos, mentor, capa_url)
       VALUES (?, ?, ?, ?, ?)`,
      [nome.trim(), Number(metaArrecadacao ?? 0), metaAlimentos || null, mentor || null, capaDataUrl || null] // Adicionado mentor e capaDataUrl
    );
    const groupId = ins.insertId; //

    const validMembers = Array.isArray(membros) //
      ? membros.filter(m => m?.nome && m?.ra)
      : [];
    if (validMembers.length) {
      const values = validMembers.map(m => [groupId, m.nome, String(m.ra), m.telefone ?? null]); //
      await conn.query( //
        `INSERT INTO grupo_membro (ID_grupo, nome, ra, telefone) VALUES ?`,
        [values]
      );
    }

    await conn.commit(); //

    // Retorna o grupo criado (sem precisar buscar novamente, exceto pelos membros se a lógica for complexa)
    // O progresso inicial será 0.
    const grupoCriado = {
      ID_grupo: groupId,
      nome_grupo: nome.trim(),
      meta_arrecadacao: Number(metaArrecadacao ?? 0),
      meta_alimentos: metaAlimentos || null,
      capa_url: capaDataUrl || null,
      mentor: mentor || null,
      // Não temos criado_em, atualizado_em nesta simulação simples
    };

    // Mapeia para o formato do cliente (progresso será 0)
    res.status(201).json(mapToClient(grupoCriado, validMembers.map(m => ({...m, telefone: m.telefone ?? ""})))); //
  } catch (e) {
    await conn.rollback(); //
    console.error("Erro em createGrupo:", e); // Adicionado log de erro
    res.status(500).json({ error: "Erro ao criar grupo" }); //
  } finally {
    conn.release(); //
  }
}

// PUT /grupos/:id
// body parcial: { nome?, metaArrecadacao?, metaAlimentos?, membros? (substitui lista), mentor?, capaDataUrl? }
export async function updateGrupo(req, res) { //
  const { id } = req.params;
  const { nome, metaArrecadacao, metaAlimentos, membros, mentor, capaDataUrl } = req.body; // Adicionado mentor, capaDataUrl

  const conn = await pool.getConnection(); //
  try {
    await conn.beginTransaction(); //

    const fields = [];
    const params = [];
    if (nome !== undefined) { fields.push("nome_grupo=?"); params.push(nome?.trim() || null); } //
    if (metaArrecadacao !== undefined) { fields.push("meta_arrecadacao=?"); params.push(Number(metaArrecadacao ?? 0)); } //
    if (metaAlimentos !== undefined) { fields.push("meta_alimentos=?"); params.push(metaAlimentos || null); } //
    if (mentor !== undefined) { fields.push("mentor=?"); params.push(mentor || null); } // Mentor adicionado
    if (capaDataUrl !== undefined) { fields.push("capa_url=?"); params.push(capaDataUrl || null); } // Capa adicionada

    if (fields.length) {
      params.push(id);
      await conn.query(`UPDATE grupo SET ${fields.join(", ")} WHERE ID_grupo=?`, params); //
    }

    let membrosOut;
    // Somente atualiza membros se o array 'membros' for explicitamente passado no body
    if (Array.isArray(membros)) { //
      await conn.query(`DELETE FROM grupo_membro WHERE ID_grupo=?`, [id]); //
      const valid = membros.filter(m => m?.nome && m?.ra); //
      if (valid.length) {
        const values = valid.map(m => [id, m.nome, String(m.ra), m.telefone ?? null]); //
        await conn.query( //
          `INSERT INTO grupo_membro (ID_grupo, nome, ra, telefone) VALUES ?`,
          [values]
        );
      }
      membrosOut = valid.map(m => ({ ...m, telefone: m.telefone ?? "" })); //
    }

    await conn.commit(); //

    // Após salvar, busca o grupo ATUALIZADO e seus membros ATUALIZADOS para retornar
    // (Incluindo os cálculos de progresso atualizados)
    const [rows] = await pool.query(`SELECT * FROM grupo WHERE ID_grupo=?`, [id]); //
    if (!rows.length) return res.status(404).json({ error: "Grupo não encontrado" }); //
    const row = rows[0];

    // Se membros não foram atualizados na requisição, busca os atuais no banco
    if (!membrosOut) { //
      const [mrows] = await pool.query( //
        `SELECT nome, ra, telefone FROM grupo_membro WHERE ID_grupo=? ORDER BY nome ASC`,
        [id]
      );
      membrosOut = (mrows ?? []).map(m => ({ nome: m.nome, ra: m.ra, telefone: m.telefone ?? "" })); //
    }

    // Recalcula progressos atualizados
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

    res.json(mapToClient( //
      row,
      membrosOut,
      moneyProgress?.total_arrecadado ?? 0,
      itemProgress?.total_itens ?? 0
    ));
  } catch (e) {
    await conn.rollback(); //
    console.error(`Erro em updateGrupo(${id}):`, e); // Adicionado log de erro
    res.status(500).json({ error: "Erro ao atualizar grupo" }); //
  } finally {
    conn.release(); //
  }
}

// DELETE /grupos/:id
export async function deleteGrupo(req, res) { //
  const { id } = req.params;
  // ATENÇÃO: A constraint ON DELETE CASCADE na tabela grupo_membro e doacao
  // fará com que membros e doações sejam excluídos automaticamente ao deletar o grupo.
  // Considere se este é o comportamento desejado ou se prefere um soft delete.
  try {
    const [r] = await pool.query(`DELETE FROM grupo WHERE ID_grupo=?`, [id]); //
    if (r.affectedRows === 0) return res.status(404).json({ error: "Grupo não encontrado" }); //
    res.json({ message: "Grupo excluído com sucesso" }); //
  } catch(e) { // Adicionado 'e' para log
    console.error(`Erro em deleteGrupo(${id}):`, e); // Adicionado log de erro
    res.status(500).json({ error: "Erro ao excluir grupo" }); //
  }
}