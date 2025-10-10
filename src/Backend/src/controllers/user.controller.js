// src/controllers/user.controller.js
'use strict';
const { getDb } = require('../DataBase/db');

/**
 * GET /api/usuarios
 */
async function listUsers(req, res, next) {
  try {
    const db = getDb();
    const [rows] = await db.query('SELECT * FROM usuarios ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/usuarios/:id
 */
async function getUserById(req, res, next) {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const [rows] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/usuarios
 * body: { nome, email }
 */
async function createUser(req, res, next) {
  try {
    const db = getDb();
    const { nome, email } = req.body || {};
    if (!nome || !email) return res.status(400).json({ error: 'nome e email são obrigatórios' });

    const [result] = await db.query(
      'INSERT INTO usuarios (nome, email) VALUES (?, ?)',
      [nome, email]
    );
    res.status(201).json({ id: result.insertId, nome, email });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }
    next(err);
  }
}

/**
 * PUT /api/usuarios/:id
 * body: { nome?, email? }
 */
async function updateUser(req, res, next) {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const { nome, email } = req.body || {};

    const [result] = await db.query(
      'UPDATE usuarios SET nome = COALESCE(?, nome), email = COALESCE(?, email) WHERE id = ?',
      [nome ?? null, email ?? null, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }
    next(err);
  }
}

/**
 * DELETE /api/usuarios/:id
 */
async function deleteUser(req, res, next) {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const [result] = await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};