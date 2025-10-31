// src/Backend/src/controllers/authController.js
import { getDb } from '../DataBase/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // Para hash e tokens
import { sendResetEmail } from '../services/emailService.js'; // Para o envio (simulado)

const {
  JWT_SECRET,
  JWT_EXPIRES_IN = '15m',
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN = '7d',
  NODE_ENV = 'development',
} = process.env;

const isProd = NODE_ENV === 'production';

// --- Funções Auxiliares (Sua versão) ---

function cargoToTipo(cargo) {
  const c = String(cargo || '').toLowerCase();
  if (c === 'adm' || c === 'admin') return 'adm';
  if (c === 'mentor' || c === 'professor') return 'mentor';
  return 'aluno';
}

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
  const refresh = jwt.sign(
    { sid: payload.sid, uid: payload.uid, role: payload.role },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
  };
  res.cookie('le_access', access, { ...base, maxAge: 15 * 60 * 1000 });
  res.cookie('le_refresh', refresh, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res) {
  res.clearCookie('le_access', { path: '/' });
  res.clearCookie('le_refresh', { path: '/' });
}

function assertJwtEnv() {
  const missing = [];
  if (!JWT_SECRET) missing.push('JWT_SECRET');
  if (!JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');
  if (missing.length) {
    const msg = `Variáveis ausentes: ${missing.join(', ')}`;
    console.error('[AUTH]', msg);
    const err = new Error(msg);
    err.code = 'ENV_MISSING';
    throw err;
  }
}

// --- Endpoints de Autenticação ---

// POST /api/auth/login (Sua versão com assertJwtEnv)
export async function login(req, res) {
  const pool = getDb();
  const { method, identifier, senha } = req.body || {};
  if (!method || !identifier || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios: method, identifier, senha' });
  }
  try {
    assertJwtEnv(); // Sua adição

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

    const payloadUser = {
      id: user.ID_usuario,
      tipo,
      nome: user.nome_usuario,
      email: user.email || '',
      ra: user.RA || '',
      grupoId: user.ID_grupo ?? null,
      grupoNome: user.nome_grupo ?? null,
      fotoUrl: null,
    };

    const sessionPayload = {
      sid: Date.now().toString(36) + ':' + user.ID_usuario,
      uid: user.ID_usuario,
      role: tipo,
    };

    setAuthCookies(res, sessionPayload);
    return res.json({ user: payloadUser });
  } catch (err) {
    if (err.code === 'ENV_MISSING') {
      return res.status(500).json({ error: err.message });
    }
    console.error('auth.login error:', err);
    return res.status(500).json({ error: 'Erro ao autenticar' });
  }
}

// POST /api/auth/refresh (Sua versão com assertJwtEnv)
export async function refresh(req, res) {
  try {
    assertJwtEnv(); // Sua adição
    const token = req.cookies?.le_refresh;
    if (!token) return res.status(401).json({ error: 'Sem refresh token' });
    const data = jwt.verify(token, JWT_REFRESH_SECRET); // { sid, uid, role? }
    const payload = { sid: data.sid, uid: data.uid, role: data.role || 'user' };
    setAuthCookies(res, payload);
    return res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ENV_MISSING') {
      return res.status(500).json({ error: e.message });
    }
    return res.status(401).json({ error: 'Refresh inválido/expirado' });
  }
}

// POST /api/auth/logout (Sua versão)
export async function logout(_req, res) {
  clearAuthCookies(res);
  return res.json({ ok: true });
}

// =================================================================
// FUNÇÕES DE REDEFINIÇÃO DE SENHA
// =================================================================

/**
 * POST /api/auth/request-reset
 * Etapa 1: Solicitação de redefinição (da minha sugestão anterior)
 */
export async function requestPasswordReset(req, res) {
  const pool = getDb();
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT ID_usuario, nome_usuario FROM usuario WHERE email = ? LIMIT 1',
      [email]
    );

    if (!rows || rows.length === 0) {
      console.log(`[Reset Senha] Solicitação para e-mail não cadastrado: ${email}`);
      return res.json({ message: 'Solicitação recebida.' });
    }

    const user = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 3600 * 1000); // 1 hora

    // Limpa tokens antigos antes de inserir o novo
    await pool.query('DELETE FROM password_resets WHERE ID_usuario = ?', [user.ID_usuario]);
    
    await pool.query(
      'INSERT INTO password_resets (ID_usuario, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.ID_usuario, hash, expires]
    );

    const resetLink = `http://localhost:5173/redefinir-senha?token=${token}&uid=${user.ID_usuario}`;
    
    await sendResetEmail(email, user.nome_usuario, resetLink); 

    console.log(`[Reset Senha] Link enviado para ${email}`);
    return res.json({ message: 'Solicitação recebida.' });

  } catch (err) {
    console.error('auth.requestPasswordReset error:', err);
    return res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
}


/**
 * POST /api/auth/reset-password
 * Etapa 2: Execução da redefinição (NOVA FUNÇÃO)
 */
export async function resetPassword(req, res) {
  const pool = getDb();
  const { token, uid, newPassword } = req.body;

  // 1. Validação básica
  if (!token || !uid || !newPassword) {
    return res.status(400).json({ error: 'Campos obrigatórios: token, uid, newPassword' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
  }

  try {
    // 2. Encontrar o token válido no banco de dados
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    
    const [rows] = await pool.query(
      'SELECT * FROM password_resets WHERE ID_usuario = ? AND token_hash = ? AND expires_at > NOW()',
      [uid, hash]
    );

    if (!rows || rows.length === 0) {
      console.warn(`[Reset Senha] Tentativa de reset falhou: token inválido/expirado para uid ${uid}`);
      return res.status(400).json({ error: 'Token inválido ou expirado. Por favor, solicite um novo link.' });
    }

    // 3. O token é válido. Atualizar a senha do usuário
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    await pool.query(
      'UPDATE usuario SET senha = ? WHERE ID_usuario = ?',
      [newPasswordHash, uid]
    );

    // 4. Limpeza: Excluir *todos* os tokens de reset para este usuário
    //    Isso garante que o link não possa ser reutilizado.
    await pool.query(
      'DELETE FROM password_resets WHERE ID_usuario = ?',
      [uid]
    );

    console.log(`[Reset Senha] Senha atualizada com sucesso para uid ${uid}`);
    
    // 5. Limpar cookies de login (se houver) para forçar o novo login
    clearAuthCookies(res);
    
    return res.json({ message: 'Senha redefinida com sucesso!' });

  } catch (err) {
    console.error('auth.resetPassword error:', err);
    return res.status(500).json({ error: 'Erro interno ao redefinir a senha.' });
  }
}

