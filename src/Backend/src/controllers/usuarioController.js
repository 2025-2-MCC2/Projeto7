// src/Backend/src/controllers/usuarioController.js
import { getDb } from '../DataBase/db.js';
import bcrypt from 'bcrypt';

// GET todos
export async function getUsuarios(_req, res) {
  const pool = getDb();
  try {
    const [rows] = await pool.query(`
      SELECT u.ID_usuario, u.RA, u.nome_usuario, u.email, u.cargo, u.ID_grupo, g.nome_grupo
      FROM usuario u
      LEFT JOIN grupo g ON u.ID_grupo = g.ID_grupo
      ORDER BY u.ID_usuario DESC
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
}

// GET por id
export async function getUsuarioById(req, res) {
  const pool = getDb();
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT u.ID_usuario, u.RA, u.nome_usuario, u.email, u.cargo, u.ID_grupo, g.nome_grupo
       FROM usuario u
       LEFT JOIN grupo g ON u.ID_grupo = g.ID_grupo
       WHERE u.ID_usuario = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
}

// Util: normaliza/hasha senha (aceita já-hash $2...)
async function normalizePass(pass) {
  const s = String(pass || '');
  if (!s) return s;
  if (s.startsWith('$2')) return s; // já é bcrypt
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(s, salt);
}

// POST criar
export async function createUsuario(req, res) {
  const pool = getDb();
  const { RA, nome_usuario, email, senha, cargo, ID_grupo } = req.body;
  if (!nome_usuario || !email || !senha || !cargo) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome_usuario, email, senha, cargo' });
  }
  try {
    const hashed = await normalizePass(senha);
    const [ins] = await pool.query(
      'INSERT INTO usuario (RA, nome_usuario, email, senha, cargo, ID_grupo) VALUES (?, ?, ?, ?, ?, ?)',
      [RA ?? null, nome_usuario, email, hashed, cargo, ID_grupo ?? null]
    );
    const [rows] = await pool.query('SELECT * FROM usuario WHERE ID_usuario = ?', [ins.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'RA ou email já cadastrados' });
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

// PUT atualizar
export async function updateUsuario(req, res) {
  const pool = getDb();
  const { id } = req.params;
  const { RA, nome_usuario, email, senha, cargo, ID_grupo } = req.body;
  try {
    const hashed = senha ? await normalizePass(senha) : null;
    const [result] = await pool.query(
      'UPDATE usuario SET RA=?, nome_usuario=?, email=?, senha=COALESCE(?, senha), cargo=?, ID_grupo=? WHERE ID_usuario=?',
      [RA ?? null, nome_usuario, email, hashed, cargo, ID_grupo ?? null, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    const [rows] = await pool.query('SELECT * FROM usuario WHERE ID_usuario = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'RA ou email já cadastrados' });
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

// DELETE
export async function deleteUsuario(req, res) {
  const pool = getDb();
  const { id } = req.params;
  try {
    const [r] = await pool.query('DELETE FROM usuario WHERE ID_usuario = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ message: 'Usuário excluído com sucesso' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
}