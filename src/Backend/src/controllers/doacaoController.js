// controllers/doacaoController.js
import { pool } from "../DataBase/db.js"; //
// Assumindo que sse.js existe para notificações em tempo real
import { pushDashboardUpdate } from "../services/sse.js"; //

// GET /api/grupos/:grupoId/doacoes?status=pendente|aprovada|rejeitada|todas
export async function listDoacoesByGrupo(req, res) { //
  const { grupoId } = req.params;
  const { status = "todas" } = req.query; //
  try {
    const params = [grupoId];
    let where = "WHERE d.ID_grupo = ?"; //
    const validStatuses = ['pendente', 'aprovada', 'rejeitada'];
    if (status !== "todas" && validStatuses.includes(status)) { //
      where += " AND d.status_doacao = ?"; // Usa status_doacao
      params.push(status);
    }
    const [rows] = await pool.query( //
      `SELECT
           d.ID_doacao, d.ID_grupo, d.ID_usuario_registro, d.ID_postagem,
           d.doacao_data_registro, d.status_doacao, d.tipo_doacao,
           d.doador_nome, d.descricao,
           d.valor_doacao, d.item_doacao, d.quantidade, d.unidade,
           u.nome_usuario AS nome_usuario_registro
         FROM doacao d
         LEFT JOIN usuario u ON d.ID_usuario_registro = u.ID_usuario
         ${where}
         ORDER BY d.doacao_data_registro DESC, d.ID_doacao DESC`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error("Erro em listDoacoesByGrupo:", e);
    res.status(500).json({ error: "Erro ao listar doações" }); //
  }
}

// GET /api/grupos/:grupoId/doacoes/:id
export async function getDoacao(req, res) { //
  const { grupoId, id } = req.params;
  try {
    const [rows] = await pool.query( //
      `SELECT d.*, u.nome_usuario AS nome_usuario_registro
         FROM doacao d
         LEFT JOIN usuario u ON d.ID_usuario_registro = u.ID_usuario
        WHERE d.ID_doacao = ? AND d.ID_grupo = ?`,
      [id, grupoId]
    );
    if (!rows.length) return res.status(404).json({ error: "Doação não encontrada" }); //
    res.json(rows[0]);
  } catch (e) {
    console.error(`Erro em getDoacao(${id}):`, e);
    res.status(500).json({ error: "Erro ao buscar doação" }); //
  }
}

// POST /api/grupos/:grupoId/doacoes  (cria PENDENTE)
export async function createDoacao(req, res) { //
  const { grupoId } = req.params;
  // --- IMPORTANTE: Obtenha o ID do usuário autenticado ---
  // Substitua 'req.user?.ID_usuario' pela forma correta no seu sistema
  const idUsuarioRegistro = req.user?.ID_usuario; // Ex: vindo de um middleware JWT/Session

  if (!idUsuarioRegistro) {
      return res.status(401).json({ error: "Usuário não autenticado." });
  }

  const {
    tipo_doacao, doador_nome, descricao,
    valor_doacao,
    item_doacao, quantidade, unidade,
    ID_postagem
  } = req.body;

  // Validações
  if (!tipo_doacao || !["dinheiro", "item"].includes(tipo_doacao)) { //
    return res.status(400).json({ error: "Campo 'tipo_doacao' inválido." });
  }
  if (tipo_doacao === 'dinheiro' && (valor_doacao == null || isNaN(Number(valor_doacao)) || Number(valor_doacao) <= 0)) { //
    return res.status(400).json({ error: "'valor_doacao' inválido (> 0)." });
  }
  if (tipo_doacao === 'item' && (!item_doacao || quantidade == null || Number(quantidade) <= 0 || !unidade)) { //
    return res.status(400).json({ error: "'item_doacao', 'quantidade' (> 0) e 'unidade' são obrigatórios." });
  }

  try {
    const [ins] = await pool.query( //
      `INSERT INTO doacao
       (ID_grupo, ID_usuario_registro, ID_postagem, status_doacao, tipo_doacao, doador_nome, descricao,
        valor_doacao, item_doacao, quantidade, unidade)
       VALUES (?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?)`,
      [
        grupoId, idUsuarioRegistro, ID_postagem ?? null, tipo_doacao, doador_nome ?? null, descricao ?? null,
        tipo_doacao === 'dinheiro' ? Number(valor_doacao) : null, //
        tipo_doacao === 'item' ? item_doacao : null,             //
        tipo_doacao === 'item' ? Number(quantidade) : null,      //
        tipo_doacao === 'item' ? unidade : null                 //
      ]
    );
    const [rows] = await pool.query(`SELECT * FROM doacao WHERE ID_doacao = ?`, [ins.insertId]); //
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("Erro em createDoacao:", e);
    res.status(500).json({ error: "Erro ao criar doação" }); //
  }
}

// PUT /api/grupos/:grupoId/doacoes/:id  (editar enquanto pendente)
export async function updateDoacao(req, res) { //
  const { grupoId, id } = req.params;
  const idUsuarioEditor = req.user?.ID_usuario; // Usuário logado

  if (!idUsuarioEditor) {
      return res.status(401).json({ error: "Usuário não autenticado." });
  }

  const {
    doador_nome, descricao, valor_doacao,
    item_doacao, quantidade, unidade
  } = req.body;

  try {
    const [chk] = await pool.query( //
      `SELECT status_doacao, tipo_doacao, ID_usuario_registro FROM doacao WHERE ID_doacao = ? AND ID_grupo = ?`,
      [id, grupoId]
    );
    if (!chk.length) return res.status(404).json({ error: "Doação não encontrada" }); //
    const { status_doacao: statusAtual, tipo_doacao: tipoOriginal, ID_usuario_registro: idCriador } = chk[0];

    if (statusAtual !== "pendente") { //
      return res.status(400).json({ error: "Somente doações pendentes podem ser editadas." }); //
    }

    // --- Verificação de Permissão (Exemplo) ---
    // Permitir edição apenas para quem registrou ou para mentor/adm
    // const isOwner = idUsuarioEditor === idCriador;
    // const podeEditar = isOwner || await verificarPermissaoMentorOuAdm(idUsuarioEditor, grupoId); // Função a ser criada
    // if (!podeEditar) {
    //    return res.status(403).json({ error: "Você não tem permissão para editar esta doação." });
    // }
    // --- Fim Verificação ---


    const fields = [];
    const params = [];
    if (descricao !== undefined) { fields.push("descricao=?"); params.push(descricao ?? null); } //
    if (doador_nome !== undefined) { fields.push("doador_nome=?"); params.push(doador_nome ?? null); } //

    if (tipoOriginal === "dinheiro") { //
      if (valor_doacao !== undefined) {
          if (isNaN(Number(valor_doacao)) || Number(valor_doacao) <= 0) return res.status(400).json({ error: "Valor inválido." });
          fields.push("valor_doacao=?"); params.push(Number(valor_doacao)); //
      }
      fields.push("item_doacao=NULL, quantidade=NULL, unidade=NULL"); //
    } else { // tipoOriginal === "item"
      if (item_doacao !== undefined) { fields.push("item_doacao=?"); params.push(item_doacao || null); } //
      if (quantidade !== undefined) {
          if (isNaN(Number(quantidade)) || Number(quantidade) <= 0) return res.status(400).json({ error: "Quantidade inválida." });
          fields.push("quantidade=?"); params.push(Number(quantidade)); //
      }
      if (unidade !== undefined) { fields.push("unidade=?"); params.push(unidade || null); } //
      fields.push("valor_doacao=NULL"); //
    }

    if (!fields.length) return res.json({ message: "Nada a atualizar" }); //

    params.push(id, grupoId); // IDs para o WHERE
    const [result] = await pool.query( //
      `UPDATE doacao SET ${fields.join(", ")} WHERE ID_doacao=? AND ID_grupo=?`,
      params
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Erro ao atualizar" }); //

    const [rows] = await pool.query(`SELECT * FROM doacao WHERE ID_doacao = ?`, [id]); //
    res.json(rows[0]);
  } catch (e) {
    console.error(`Erro em updateDoacao(${id}):`, e);
    res.status(500).json({ error: "Erro ao atualizar doação" }); //
  }
}

// PUT /api/grupos/:grupoId/doacoes/:id/aprovar
export async function approveDoacao(req, res) { //
  const { grupoId, id } = req.params;
  const idAprovador = req.user?.ID_usuario; //

  if (!idAprovador) return res.status(401).json({ error: "Autenticação necessária." }); //
  // TODO: Verificar se idAprovador é mentor/adm COM permissão neste grupoId

  try {
    const [chk] = await pool.query( //
      `SELECT status_doacao FROM doacao WHERE ID_doacao = ? AND ID_grupo = ?`, [id, grupoId]
    );
    if (!chk.length) return res.status(404).json({ error: "Doação não encontrada" }); //
    if (chk[0].status_doacao !== "pendente") return res.status(400).json({ error: "Apenas pendentes podem ser aprovadas." }); //

    const [result] = await pool.query( //
      `UPDATE doacao SET status_doacao='aprovada', aprovada_em=NOW(), aprovada_por=?
       WHERE ID_doacao=? AND ID_grupo=?`,
      [idAprovador, id, grupoId] //
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Erro ao aprovar." }); //

    pushDashboardUpdate(String(grupoId), { type: "dashboard_updated", grupoId: Number(grupoId) }); //

    const [rows] = await pool.query(`SELECT * FROM doacao WHERE ID_doacao=?`, [id]); //
    res.json(rows[0]);
  } catch (e) {
    console.error(`Erro approveDoacao(${id}):`, e); //
    res.status(500).json({ error: "Erro interno ao aprovar" }); //
  }
}

// PUT /api/grupos/:grupoId/doacoes/:id/rejeitar
export async function rejectDoacao(req, res) { //
  const { grupoId, id } = req.params;
  const idRejeitador = req.user?.ID_usuario; //
  const { observacao } = req.body; //

  if (!idRejeitador) return res.status(401).json({ error: "Autenticação necessária." }); //
  // TODO: Verificar se idRejeitador é mentor/adm COM permissão neste grupoId

  try {
    const [chk] = await pool.query( //
      `SELECT status_doacao FROM doacao WHERE ID_doacao = ? AND ID_grupo = ?`, [id, grupoId]
    );
    if (!chk.length) return res.status(404).json({ error: "Doação não encontrada" }); //
    if (chk[0].status_doacao !== "pendente") return res.status(400).json({ error: "Apenas pendentes podem ser rejeitadas." }); //

    const [result] = await pool.query( //
      `UPDATE doacao SET status_doacao='rejeitada', rejeitada_em=NOW(), rejeitada_por=?, observacao=?
       WHERE ID_doacao=? AND ID_grupo=?`,
      [idRejeitador, observacao ?? null, id, grupoId] //
    );
     if (result.affectedRows === 0) return res.status(404).json({ error: "Erro ao rejeitar." }); //

    pushDashboardUpdate(String(grupoId), { type: "dashboard_updated", grupoId: Number(grupoId) }); //

    const [rows] = await pool.query(`SELECT * FROM doacao WHERE ID_doacao=?`, [id]); //
    res.json(rows[0]);
  } catch (e) {
    console.error(`Erro rejectDoacao(${id}):`, e); //
    res.status(500).json({ error: "Erro interno ao rejeitar" }); //
  }
}

// DELETE /api/grupos/:grupoId/doacoes/:id
export async function deleteDoacao(req, res) { //
  const { grupoId, id } = req.params;
  const idDeletor = req.user?.ID_usuario; // Usuário logado

  if (!idDeletor) return res.status(401).json({ error: "Autenticação necessária." });

  try {
    // Busca status e quem registrou para validar permissão
    const [chk] = await pool.query(
      `SELECT status_doacao, ID_usuario_registro FROM doacao WHERE ID_doacao=? AND ID_grupo=?`,
      [id, grupoId]
    );

    if (!chk.length) return res.status(404).json({ error: "Doação não encontrada" });

    const { status_doacao: statusAtual, ID_usuario_registro: idCriador } = chk[0];

    // --- Lógica de Permissão ---
    // Regra: Permitir deletar APENAS se status='pendente'.
    //        E QUEM pode deletar? Quem criou OU um mentor/adm.
    if (statusAtual !== 'pendente') {
        return res.status(400).json({ error: "Apenas doações pendentes podem ser excluídas." });
    }

    const isOwner = idDeletor === idCriador;
    const podeDeletar = isOwner || await verificarPermissaoMentorOuAdm(idDeletor, grupoId); // Função a ser criada
    if (!podeDeletar) {
       return res.status(403).json({ error: "Você não tem permissão para excluir esta doação." });
    }
    // --- Fim Permissão ---

    const [result] = await pool.query( // -> Query ajustada para WHERE simples
      `DELETE FROM doacao WHERE ID_doacao=? AND ID_grupo=?`, // Deleta independente do status APÓS validação
      [id, grupoId]
    );

    if (result.affectedRows === 0) { //
        // Se chegou aqui após a checagem anterior, é um erro inesperado
        console.warn(`DELETE afetou 0 linhas para doação ${id} (grupo ${grupoId}) que deveria existir.`);
        return res.status(404).json({ error: "Doação não encontrada ou erro ao excluir" });
    }

    pushDashboardUpdate(String(grupoId), { type: "dashboard_updated", grupoId: Number(grupoId) });
    res.json({ message: "Doação excluída com sucesso" }); //
  } catch (e) {
    console.error(`Erro deleteDoacao(${id}):`, e);
    res.status(500).json({ error: "Erro ao excluir doação" }); //
  }
}

// Função placeholder para verificar permissão (exemplo)
// async function verificarPermissaoMentorOuAdm(usuarioId, grupoId) {
//   try {
//     const [[user]] = await pool.query('SELECT cargo, ID_grupo FROM usuario WHERE ID_usuario = ?', [usuarioId]);
//     if (!user) return false;
//     if (user.cargo === 'adm') return true;
//     if (user.cargo === 'mentor') {
//        // Verifica se é mentor DESTE grupo específico (requer JOIN ou consulta adicional)
//        // Exemplo simples (se mentor está ligado diretamente ao grupo na tabela usuario):
//        // return user.ID_grupo === Number(grupoId);
//        // Exemplo mais complexo (se mentoria for definida em outra tabela):
//        // const [mentorGroups] = await pool.query('SELECT ID_grupo FROM mentoria WHERE ID_mentor = ?', [usuarioId]);
//        // return mentorGroups.some(mg => mg.ID_grupo === Number(grupoId));
//        console.warn(`Lógica para verificar se ${usuarioId} é mentor do grupo ${grupoId} não implementada.`);
//        return false; // Retorna false por segurança até implementar
//     }
//     return false;
//   } catch (error) {
//     console.error("Erro ao verificar permissão:", error);
//     return false; // Falha na verificação, nega acesso por segurança
//   }
// }