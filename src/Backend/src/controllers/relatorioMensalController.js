/*
  Controller NOVO, robusto para 'parceiros' e logs melhores.
  Compatível com a tabela 'relatorio_mensal' enviada.
*/
import { pool } from "../DataBase/db.js";
import PDFDocument from 'pdfkit';

// --- Helpers de parse/normalização ---
const parseParceiros = (v) => {
  // Aceita: null/undefined => []
  // Array já parseado => retorna
  // String JSON => parse
  // Qualquer outra coisa => []
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'object') {
    // Já é objeto/array; tenta normalizar para array simples
    try {
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Se o DB tiver TEXTs não-JSON (ex.: "N/D"), evita quebrar a API
      return [];
    }
  }
  return [];
};

const toNum = (x, fallback = 0) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
};

const mapToClient = (r) => ({
  id: r.ID_relatorio,
  groupId: r.ID_grupo,
  groupName: r.nome_grupo || '',
  authorId: r.ID_usuario_autor,
  authorName: r.nome_usuario || '',
  authorRA: r.RA || '',
  dateISO: r.data_relatorio,        // Date ou string (ok pros usos do front)
  month: r.mes_referencia,
  content: r.conteudo,
  valorArrecadado: toNum(r.valor_arrecadado, 0),
  kgAlimentos: toNum(r.kg_alimentos, 0),
  qtdCestas: toNum(r.qtd_cestas, 0),
  parceiros: parseParceiros(r.parceiros),
  localAtividade: r.local_atividade,
  status: r.status,
  feedbackMentor: r.feedback_mentor,
});

const BASE_QUERY = `
  SELECT r.*, g.nome_grupo, u.nome_usuario, u.RA
  FROM relatorio_mensal r
  JOIN grupo g ON r.ID_grupo = g.ID_grupo
  JOIN usuario u ON r.ID_usuario_autor = u.ID_usuario
`;

// --- Endpoints ---

// GET /api/relatorios-mensais
export async function getRelatorios(req, res) {
  try {
    // TODO: filtros via req.query (groupId, status, author, from, to)
    const [rows] = await pool.query(`${BASE_QUERY} ORDER BY r.data_relatorio DESC`);
    res.json(rows.map(mapToClient));
  } catch (e) {
    console.error("Erro em getRelatorios:", e.sqlMessage || e.message, e.sql || '');
    res.status(500).json({ error: "Erro ao listar relatórios" });
  }
}

// POST /api/relatorios-mensais
export async function createRelatorio(req, res) {
  const {
    groupId,
    authorId, // ID do usuário logado
    dateISO,
    month,
    content,
    valorArrecadado,
    kgAlimentos,
    qtdCestas,
    parceiros,
    localAtividade,
  } = req.body;

  if (!groupId || !authorId || !dateISO || !month) {
    return res.status(400).json({ error: "Campos obrigatórios: groupId, authorId, dateISO, month" });
  }

  try {
    const [ins] = await pool.query(
      `INSERT INTO relatorio_mensal 
       (ID_grupo, ID_usuario_autor, mes_referencia, data_relatorio, conteudo, valor_arrecadado, kg_alimentos, qtd_cestas, parceiros, local_atividade, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enviado')`,
      [
        groupId,
        authorId,
        month,
        dateISO,
        content || '',
        toNum(valorArrecadado, 0),
        toNum(kgAlimentos, 0),
        toNum(qtdCestas, 0),
        // Armazena como JSON válido (string)
        JSON.stringify(Array.isArray(parceiros) ? parceiros : parseParceiros(parceiros)),
        localAtividade || null,
      ]
    );

    const [rows] = await pool.query(`${BASE_QUERY} WHERE r.ID_relatorio = ?`, [ins.insertId]);
    res.status(201).json(mapToClient(rows[0]));
  } catch (e) {
    console.error("Erro em createRelatorio:", e.sqlMessage || e.message, e.sql || '');
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: "Você já possui um relatório para este grupo neste mês. Edite o existente." });
    }
    res.status(500).json({ error: "Erro ao criar relatório" });
  }
}

// PUT /api/relatorios-mensais/:id
export async function updateRelatorio(req, res) {
  const { id } = req.params;
  const {
    dateISO,
    month,
    content,
    valorArrecadado,
    kgAlimentos,
    qtdCestas,
    parceiros,
    localAtividade,
    authorId // para verificação
  } = req.body;

  try {
    const [check] = await pool.query(
      "SELECT ID_usuario_autor FROM relatorio_mensal WHERE ID_relatorio = ?",
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: "Relatório não encontrado." });
    }
    if (check[0].ID_usuario_autor !== authorId) {
      return res.status(403).json({ error: "Você não tem permissão para editar este relatório." });
    }

    await pool.query(
      `UPDATE relatorio_mensal SET
         data_relatorio = ?, 
         mes_referencia = ?, 
         conteudo = ?, 
         valor_arrecadado = ?, 
         kg_alimentos = ?, 
         qtd_cestas = ?, 
         parceiros = ?, 
         local_atividade = ?,
         status = 'enviado'
       WHERE ID_relatorio = ?`,
      [
        dateISO,
        month,
        content || '',
        toNum(valorArrecadado, 0),
        toNum(kgAlimentos, 0),
        toNum(qtdCestas, 0),
        JSON.stringify(Array.isArray(parceiros) ? parceiros : parseParceiros(parceiros)),
        localAtividade || null,
        id
      ]
    );

    const [rows] = await pool.query(`${BASE_QUERY} WHERE r.ID_relatorio = ?`, [id]);
    res.json(mapToClient(rows[0]));
  } catch (e) {
    console.error("Erro em updateRelatorio:", e.sqlMessage || e.message, e.sql || '');
    res.status(500).json({ error: "Erro ao atualizar relatório" });
  }
}

// PUT /api/relatorios-mensais/:id/status
export async function updateStatus(req, res) {
  const { id } = req.params;
  const { status, feedbackMentor, mentorId } = req.body;

  // TODO (opcional): verificar se mentorId tem acesso ao grupo do relatório via tabela grupo_mentor

  try {
    const [upd] = await pool.query(
      `UPDATE relatorio_mensal SET status = ?, feedback_mentor = ? WHERE ID_relatorio = ?`,
      [status, feedbackMentor || null, id]
    );

    if (upd.affectedRows === 0) {
      return res.status(404).json({ error: "Relatório não encontrado." });
    }

    const [rows] = await pool.query(`${BASE_QUERY} WHERE r.ID_relatorio = ?`, [id]);
    res.json(mapToClient(rows[0]));
  } catch (e) {
    console.error("Erro em updateStatus:", e.sqlMessage || e.message, e.sql || '');
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
}

// GET /api/relatorios-mensais/export/pdf
export async function exportPdf(req, res) {
  try {
    const [rows] = await pool.query(`${BASE_QUERY} ORDER BY r.data_relatorio DESC`);
    const reports = rows.map(mapToClient);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorios.pdf"');
    doc.pipe(res);

    doc.fontSize(18).fillColor('#1b4332').text('Relatório de Atividades', { align: 'center' });
    doc.moveDown(1.5);

    if (reports.length === 0) {
      doc.fontSize(12).fillColor('#333').text('Nenhum relatório encontrado.', { align: 'center' });
      doc.end();
      return;
    }

    reports.forEach((r, i) => {
      doc.fontSize(14).fillColor('#1b4332').text(`${r.groupName} - ${r.month}`);
      doc.fontSize(10).fillColor('#555').text(`Autor: ${r.authorName} | Data: ${r.dateISO} | Status: ${r.status}`);
      doc.moveDown(0.5);

      doc.fontSize(11).fillColor('#000');
      doc.list(
        [
          `Valor Arrecadado: ${(r.valorArrecadado ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          `Alimentos: ${r.kgAlimentos} kg`,
          `Cestas Básicas: ${r.qtdCestas} un`,
          `Local: ${r.localAtividade || 'N/D'}`,
          `Parceiros: ${r.parceiros.length > 0 ? r.parceiros.join(', ') : 'N/D'}`,
        ],
        { bulletRadius: 2, textIndent: 10 }
      );

      doc.moveDown(0.5);
      doc.fontSize(11).text('Descrição:', { underline: true });
      doc.fontSize(11).text(r.content || 'Nenhuma descrição fornecida.');

      if (r.feedbackMentor) {
        doc.fillColor('#2e7d32').text('Feedback do Mentor:', { underline: true });
        doc.fillColor('#000').text(r.feedbackMentor);
      }

      if (i < reports.length - 1) doc.addPage();
    });

    doc.end();
  } catch (e) {
    console.error("Erro em exportPdf:", e.sqlMessage || e.message, e.sql || '');
    res.status(500).json({ error: "Erro ao gerar PDF" });
  }
}
