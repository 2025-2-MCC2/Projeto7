// src/Backend/src/controllers/authController.js
import { getDb } from '../DataBase/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const {
  JWT_SECRET,
  JWT_EXPIRES_IN = '15m',
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN = '7d',
  NODE_ENV = 'development',
} = process.env;

const isProd = NODE_ENV === 'production';

/** Mapeia cargo -> tipo esperado pelo front */
function cargoToTipo(cargo) {
  const c = String(cargo || '').toLowerCase();
  if (c === 'adm' || c === 'admin') return 'adm';
  if (c === 'mentor' || c === 'professor') return 'mentor';
  return 'aluno';
}

/** Senha: aceita hash bcrypt ($2...) ou texto puro (compat legada) */
async function checkPassword(plain, dbStored) {
  const s = String(dbStored || '');
  if (!s) return false;
  if (s.startsWith('$2')) {
    try { return await bcrypt.compare(plain, s); }
    catch { return false; }
  }
  return plain === s;
}

function setAuthCookies(res, payload) {
  const access = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refresh = jwt.sign({ sid: payload.sid, uid: payload.uid, role: payload.role }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });

  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
  };

  res.cookie('le_access', access, { ...base, maxAge: 15 * 60 * 1000 });        // 15 min
  res.cookie('le_refresh', refresh, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 dias
}

function clearAuthCookies(res) {
  res.clearCookie('le_access', { path: '/' });
  res.clearCookie('le_refresh', { path: '/' });
}

/**
 * POST /api/auth/login
 * body: { method: 'email'|'ra', identifier: string, senha: string }
 */
export async function login(req, res) {
  const pool = getDb();
  const { method, identifier, senha } = req.body || {};

  if (!method || !identifier || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios: method, identifier, senha' });
  }

  try {
    let sql = `
      SELECT u.ID_usuario, u.RA, u.nome_usuario, u.email, u.senha, u.cargo, u.ID_grupo,
             g.nome_grupo
      FROM usuario u
      LEFT JOIN grupo g ON u.ID_grupo = g.ID_grupo
      WHERE `;
    const params = [];

    if (method === 'email') {
      sql += 'u.email = ? LIMIT 1';
      params.push(identifier);
    } else if (method === 'ra') {
      sql += 'u.RA = ? LIMIT 1';
      params.push(identifier);
    } else {
      return res.status(400).json({ error: "method inválido. Use 'email' ou 'ra'." });
    }

    const [rows] = await pool.query(sql, params);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas' });

    const user = rows[0];
    const ok = await checkPassword(senha, user.senha);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

    const tipo = cargoToTipo(user.cargo);

    // payload devolvido ao front
    const payloadUser = {
      id: user.ID_usuario,
      tipo,
      nome: user.nome_usuario,
      email: user.email || '',
      ra: user.RA || '',
      grupoId: user.ID_grupo || null,
      grupoNome: user.nome_grupo || null,
      fotoUrl: null, // se você adicionar coluna foto_url depois, preencha aqui
    };

    // payload para os cookies (não exponha infos sensíveis)
    const sessionPayload = {
      sid: Date.now().toString(36) + ':' + user.ID_usuario,
      uid: user.ID_usuario,
      role: tipo,
    };

    setAuthCookies(res, sessionPayload);
    return res.json({ user: payloadUser });
  } catch (err) {
    console.error('auth.login error:', err);
    return res.status(500).json({ error: 'Erro ao autenticar' });
  }
}

/** POST /api/auth/refresh — renova cookies a partir do refresh */
export async function refresh(req, res) {
  try {
    const token = req.cookies?.le_refresh;
    if (!token) return res.status(401).json({ error: 'Sem refresh token' });

    const data = jwt.verify(token, JWT_REFRESH_SECRET); // { sid, uid, role? }

    const payload = { sid: data.sid, uid: data.uid, role: data.role || 'user' };
    setAuthCookies(res, payload);

    return res.json({ ok: true });
  } catch {
    return res.status(401).json({ error: 'Refresh inválido/expirado' });
  }
}

/** POST /api/auth/logout — limpa cookies */
export async function logout(_req, res) {
  clearAuthCookies(res);
  return res.json({ ok: true });
}
